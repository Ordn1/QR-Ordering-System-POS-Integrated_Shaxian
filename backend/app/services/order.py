from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import (
    KitchenQueue,
    MenuItem,
    Payment,
    Session,
    SessionDevice,
    Transaction,
    TransactionItem,
)
from app.models.enums import PaymentMethod, PaymentStatus, PriorityStatus, TxnStatus
from app.services import queue as queue_service
from app.services import session as session_service

CENTAVO = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENTAVO, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class CartLine:
    item_id: str
    quantity: int
    unit_price: Decimal
    discount_eligible: bool = False
    device_id: int | None = None


@dataclass(frozen=True)
class PricedLine:
    item_id: str
    device_id: int | None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    is_discounted: bool
    discount_amount: Decimal
    line_net: Decimal = Decimal("0.00")


@dataclass(frozen=True)
class PricedOrder:
    lines: tuple[PricedLine, ...]
    gross_amount: Decimal
    vatable_sales: Decimal
    vat_exempt_sales: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
    item_count: int


def price_order(lines: list[CartLine]) -> PricedOrder:
    """Price a cart per Algorithms.md §4, branching per line so mixed group orders reconcile."""
    divisor = Decimal(1) + settings.VAT_RATE

    priced: list[PricedLine] = []
    gross_total = Decimal(0)
    vatable_total = Decimal(0)
    exempt_total = Decimal(0)
    vat_total = Decimal(0)
    discount_total = Decimal(0)
    net_total = Decimal(0)
    units = 0

    for line in lines:
        line_gross = money(line.unit_price * line.quantity)

        if line.discount_eligible:
            line_exempt = money(line_gross / divisor)
            line_discount = money(line_exempt * settings.STATUTORY_DISCOUNT)
            line_net = line_exempt - line_discount
            line_vatable = Decimal("0.00")
            line_vat = Decimal("0.00")
        else:
            line_vatable = money(line_gross / divisor)
            line_vat = line_gross - line_vatable
            line_net = line_gross
            line_exempt = Decimal("0.00")
            line_discount = Decimal("0.00")

        priced.append(
            PricedLine(
                item_id=line.item_id,
                device_id=line.device_id,
                quantity=line.quantity,
                unit_price=line.unit_price,
                subtotal=line_gross,
                is_discounted=line.discount_eligible,
                discount_amount=line_discount,
                line_net=line_net,
            )
        )

        gross_total += line_gross
        vatable_total += line_vatable
        exempt_total += line_exempt
        vat_total += line_vat
        discount_total += line_discount
        net_total += line_net
        units += line.quantity

    order = PricedOrder(
        lines=tuple(priced),
        gross_amount=gross_total,
        vatable_sales=vatable_total,
        vat_exempt_sales=exempt_total,
        vat_amount=vat_total,
        discount_amount=discount_total,
        net_amount=net_total,
        item_count=units,
    )

    # Validate
    assert_reconciles(order)
    return order


def assert_reconciles(order: PricedOrder) -> None:
    """Refuse to write a transaction whose tax columns do not balance, per Algorithms.md §7.2."""
    expected = (
        order.vat_exempt_sales - order.discount_amount + order.vatable_sales + order.vat_amount
    )
    if expected != order.net_amount:
        raise ValueError(
            f"transaction does not reconcile: exempt {order.vat_exempt_sales} "
            f"- discount {order.discount_amount} + vatable {order.vatable_sales} "
            f"+ vat {order.vat_amount} = {expected}, net_amount is {order.net_amount}"
        )

    line_gross = sum((line.subtotal for line in order.lines), Decimal(0))
    if line_gross != order.gross_amount:
        raise ValueError(
            f"line subtotals sum to {line_gross}, gross_amount is {order.gross_amount}"
        )


async def next_queue_number(db: AsyncSession) -> int:
    """Reserve today's next queue number under an advisory lock held to commit."""
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext('queue_number:' || CURRENT_DATE::text))")
    )
    highest = await db.scalar(
        select(func.coalesce(func.max(Transaction.queue_number), 0)).where(
            Transaction.queue_date == func.current_date()
        )
    )
    return highest + 1


def _resolve_requested_with_devices(
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
    checkout_scope: str,
) -> list[tuple[str, int, int]]:
    if requested:
        session_service.update_device_cart(session_id, device.device_id, requested)

    if checkout_scope in ("table", "split"):
        all_lines = session_service.get_all_session_cart_lines(session_id)
        if all_lines:
            return all_lines

    return [(item_id, qty, device.device_id) for item_id, qty in requested]


async def build_cart(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
    checkout_scope: str = "single",
) -> list[CartLine]:
    """Resolve a requested cart into priceable lines, validating session and stock."""
    ordering_session = await session_service.get_session(db, session_id)
    if ordering_session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    if checkout_scope in ("split", "table"):
        existing_txn = await find_open_split_transaction(db, session_id)
        if existing_txn is not None:
            if checkout_scope == "split":
                existing_rows = list(
                    await db.scalars(
                        select(TransactionItem).where(
                            TransactionItem.txn_id == existing_txn.txn_id,
                            TransactionItem.device_id == device.device_id,
                        )
                    )
                )
            else:
                unpaid_dev_ids = list(
                    await db.scalars(
                        select(Payment.device_id).where(
                            Payment.txn_id == existing_txn.txn_id,
                            Payment.status != PaymentStatus.PAID,
                        )
                    )
                )
                existing_rows = list(
                    await db.scalars(
                        select(TransactionItem).where(
                            TransactionItem.txn_id == existing_txn.txn_id,
                            TransactionItem.device_id.in_(
                                [d for d in unpaid_dev_ids if d is not None]
                            ),
                        )
                    )
                )
            if existing_rows:
                eligible = await session_service.discount_eligible(db, session_id)
                return [
                    CartLine(
                        item_id=row.item_id,
                        quantity=row.quantity,
                        unit_price=row.unit_price,
                        discount_eligible=eligible,
                        device_id=row.device_id,
                    )
                    for row in existing_rows
                ]

    resolved = _resolve_requested_with_devices(
        session_id, device, requested, "single" if checkout_scope == "split" else checkout_scope
    )
    if not resolved:
        raise BusinessRuleError("Your cart is empty. Add an item before checking out.")

    eligible = await session_service.discount_eligible(db, session_id)
    items = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(MenuItem.item_id.in_([item_id for item_id, _, _ in resolved]))
        )
    }

    lines: list[CartLine] = []
    for item_id, quantity, line_device_id in resolved:
        item = items.get(item_id)
        if item is None:
            raise NotFoundError("An item in your cart is no longer on the menu.")
        if not item.is_available:
            raise BusinessRuleError(f"{item.name_en} has just sold out. Remove it to continue.")
        lines.append(
            CartLine(
                item_id=item.item_id,
                quantity=quantity,
                unit_price=item.price,
                discount_eligible=eligible,
                device_id=line_device_id,
            )
        )

    return lines


async def quote_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
    checkout_scope: str = "single",
) -> PricedOrder:
    """Price a cart without recording anything, so checkout can show tax and discount."""
    return price_order(await build_cart(db, session_id, device, requested, checkout_scope))


async def find_open_split_transaction(
    db: AsyncSession, session_id: int
) -> Transaction | None:
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(
                Transaction.session_id == session_id,
                Transaction.status == TxnStatus.PENDING,
            )
            .order_by(Transaction.placed_at.desc())
        )
    )
    for txn in txns:
        payments = list(
            await db.scalars(select(Payment).where(Payment.txn_id == txn.txn_id))
        )
        if len(payments) > 1 and any(p.status != PaymentStatus.PAID for p in payments):
            return txn
    return None


async def place_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
    method: PaymentMethod,
    checkout_scope: str = "single",
) -> tuple[Transaction, Payment]:
    """Price, queue and record an order (single, full-table, or multi-phone split)."""
    ordering_session = await session_service.get_session(db, session_id)
    if ordering_session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    if checkout_scope == "split":
        existing_txn = await find_open_split_transaction(db, session_id)
        if existing_txn is not None:
            my_payment = await db.scalar(
                select(Payment).where(
                    Payment.txn_id == existing_txn.txn_id,
                    Payment.device_id == device.device_id,
                )
            )
            if my_payment is None:
                raise BusinessRuleError("This phone has no unpaid share in the active split order.")
            if my_payment.status is PaymentStatus.PAID:
                return existing_txn, my_payment
            # Update
            my_payment.method = method
            if method is PaymentMethod.CASHIER:
                my_payment.aggregator_ref = "CASHIER-CONFIRMED"
            session_service.clear_device_cart(session_id, device.device_id)
            await db.commit()
            await db.refresh(existing_txn)
            await db.refresh(my_payment)
            return existing_txn, my_payment

    if checkout_scope == "table":
        existing_txn = await find_open_split_transaction(db, session_id)
        if existing_txn is not None:
            unpaid_payments = list(
                await db.scalars(
                    select(Payment).where(
                        Payment.txn_id == existing_txn.txn_id,
                        Payment.status != PaymentStatus.PAID,
                    )
                )
            )
            if unpaid_payments:
                primary = unpaid_payments[0]
                primary.device_id = device.device_id
                primary.method = method
                primary.amount = sum((p.amount for p in unpaid_payments), Decimal("0.00"))
                primary.discount_applied = sum(
                    (p.discount_applied for p in unpaid_payments), Decimal("0.00")
                )
                if method is PaymentMethod.CASHIER:
                    primary.aggregator_ref = "CASHIER-CONFIRMED"
                for extra in unpaid_payments[1:]:
                    await db.delete(extra)
                session_service.clear_table_cart(session_id)
                await db.commit()
                await db.refresh(existing_txn)
                await db.refresh(primary)
                return existing_txn, primary

    resolved = _resolve_requested_with_devices(session_id, device, requested, checkout_scope)
    if not resolved:
        raise BusinessRuleError("Your cart is empty. Add an item before checking out.")

    eligible = await session_service.discount_eligible(db, session_id)
    items = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(MenuItem.item_id.in_([item_id for item_id, _, _ in resolved]))
        )
    }

    cart_lines: list[CartLine] = []
    for item_id, quantity, line_device_id in resolved:
        item = items.get(item_id)
        if item is None:
            raise NotFoundError("An item in your cart is no longer on the menu.")
        if not item.is_available:
            raise BusinessRuleError(f"{item.name_en} has just sold out. Remove it to continue.")
        cart_lines.append(
            CartLine(
                item_id=item.item_id,
                quantity=quantity,
                unit_price=item.price,
                discount_eligible=eligible,
                device_id=line_device_id,
            )
        )

    priced = price_order(cart_lines)
    queue_number = await next_queue_number(db)

    transaction = Transaction(
        session_id=session_id,
        gross_amount=priced.gross_amount,
        vatable_sales=priced.vatable_sales,
        vat_exempt_sales=priced.vat_exempt_sales,
        vat_amount=priced.vat_amount,
        discount_amount=priced.discount_amount,
        net_amount=priced.net_amount,
        item_count=priced.item_count,
        is_priority=ordering_session.declared_priority_status is not PriorityStatus.STANDARD,
        queue_number=queue_number,
    )
    db.add(transaction)
    await db.flush()

    db.add_all(
        TransactionItem(
            txn_id=transaction.txn_id,
            item_id=line.item_id,
            device_id=line.device_id,
            quantity=line.quantity,
            unit_price=line.unit_price,
            subtotal=line.subtotal,
            is_discounted=line.is_discounted,
            discount_amount=line.discount_amount,
        )
        for line in priced.lines
    )

    # Create
    is_split = checkout_scope == "split"
    if not is_split:
        await queue_service.place_in_queue(db, transaction)

    active_payment: Payment | None = None

    if checkout_scope == "split":
        device_totals: dict[int, tuple[Decimal, Decimal]] = {}
        for line in priced.lines:
            dev_id = line.device_id or device.device_id
            prev_net, prev_disc = device_totals.get(dev_id, (Decimal("0.00"), Decimal("0.00")))
            device_totals[dev_id] = (prev_net + line.line_net, prev_disc + line.discount_amount)

        for dev_id, (dev_net, dev_disc) in device_totals.items():
            if dev_net <= Decimal("0.00"):
                continue
            is_initiating_device = dev_id == device.device_id
            pay_row = Payment(
                txn_id=transaction.txn_id,
                device_id=dev_id,
                method=method if is_initiating_device else PaymentMethod.CASHIER,
                amount=dev_net,
                discount_applied=dev_disc,
                status=PaymentStatus.PENDING,
                aggregator_ref=(
                    None if is_initiating_device else "AWAITING-CHOICE"
                ),
                paid_at=None,
            )
            db.add(pay_row)
            if is_initiating_device or active_payment is None:
                active_payment = pay_row

        session_service.clear_table_cart(session_id)
    else:
        active_payment = Payment(
            txn_id=transaction.txn_id,
            device_id=device.device_id,
            method=method,
            amount=priced.net_amount,
            discount_applied=priced.discount_amount,
            status=PaymentStatus.PENDING,
            aggregator_ref=None,
            paid_at=None,
        )
        db.add(active_payment)
        if checkout_scope == "table":
            session_service.clear_table_cart(session_id)
        else:
            session_service.clear_device_cart(session_id, device.device_id)

    # Commit
    await db.commit()
    await db.refresh(transaction)
    if active_payment is not None:
        await db.refresh(active_payment)
    return transaction, active_payment


def aggregate_payment_status(payments: list[Payment]) -> PaymentStatus:
    if not payments:
        return PaymentStatus.PENDING
    if all(p.status is PaymentStatus.PAID for p in payments):
        return PaymentStatus.PAID
    if any(p.status is PaymentStatus.FAILED for p in payments):
        return PaymentStatus.FAILED
    return PaymentStatus.PENDING


async def get_receipt(
    db: AsyncSession, txn_id: int
) -> tuple[Transaction, list[tuple[TransactionItem, MenuItem]], list[Payment]]:
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That receipt is no longer available.")

    rows = await db.execute(
        select(TransactionItem, MenuItem)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(TransactionItem.txn_id == txn_id)
        .order_by(TransactionItem.txi_id)
    )
    payments = list(
        await db.scalars(
            select(Payment)
            .where(Payment.txn_id == txn_id)
            .order_by(Payment.payment_id.asc())
        )
    )
    return transaction, [(line, item) for line, item in rows], payments


async def session_order_status(
    db: AsyncSession, session_id: int, current_device_id: int | None = None
) -> list[dict]:
    """List this table's orders and their live queue position, newest first."""
    txns = list(
        await db.scalars(
            select(Transaction)
            .where(Transaction.session_id == session_id)
            .order_by(Transaction.placed_at.desc())
        )
    )
    if not txns:
        return []

    txn_ids = [t.txn_id for t in txns]
    slots = {
        slot.txn_id: slot
        for slot in await db.scalars(
            select(KitchenQueue).where(KitchenQueue.txn_id.in_(txn_ids))
        )
    }
    all_payments = list(
        await db.scalars(select(Payment).where(Payment.txn_id.in_(txn_ids)))
    )
    payments_by_txn: dict[int, list[Payment]] = {}
    for p in all_payments:
        payments_by_txn.setdefault(p.txn_id, []).append(p)

    # Read
    devices = list(
        await db.scalars(
            select(SessionDevice)
            .where(SessionDevice.session_id == session_id)
            .order_by(SessionDevice.joined_at.asc(), SessionDevice.device_id.asc())
        )
    )
    dev_meta = {
        dev.device_id: (idx, dev.is_host)
        for idx, dev in enumerate(devices, start=1)
    }

    result = []
    for txn in txns:
        txn_payments = payments_by_txn.get(txn.txn_id, [])
        overall_status = aggregate_payment_status(txn_payments)
        shares_total = len(txn_payments)
        shares_paid = sum(1 for p in txn_payments if p.status is PaymentStatus.PAID)
        unpaid_amount = sum(
            (p.amount for p in txn_payments if p.status != PaymentStatus.PAID),
            Decimal("0.00"),
        )
        my_share_unpaid = any(
            p.device_id == current_device_id and p.status != PaymentStatus.PAID
            for p in txn_payments
        )
        my_share_amount = sum(
            (p.amount for p in txn_payments if p.device_id == current_device_id and p.status != PaymentStatus.PAID),
            Decimal("0.00"),
        )

        shares = [
            {
                "payment_id": p.payment_id,
                "device_id": p.device_id,
                "device_number": dev_meta.get(p.device_id, (1, False))[0],
                "is_host": dev_meta.get(p.device_id, (1, False))[1],
                "is_me": p.device_id == current_device_id,
                "amount": p.amount,
                "method": p.method,
                "status": p.status,
            }
            for p in txn_payments
        ]

        result.append(
            {
                "txn_id": txn.txn_id,
                "queue_number": txn.queue_number,
                "status": txn.status,
                "is_priority": txn.is_priority,
                "queue_position": (
                    slots[txn.txn_id].queue_position
                    if txn.txn_id in slots and slots[txn.txn_id].completed_at is None
                    else None
                ),
                "net_amount": txn.net_amount,
                "payment_status": overall_status,
                "shares_total": shares_total,
                "shares_paid": shares_paid,
                "unpaid_amount": unpaid_amount,
                "my_share_unpaid": my_share_unpaid,
                "my_share_amount": my_share_amount,
                "shares": shares,
            }
        )

    return result


async def list_transactions(db: AsyncSession, limit: int = 100) -> list[tuple[Transaction, str]]:
    """List recent transactions with each one's Apriori segment, newest first."""
    rows = await db.execute(
        select(Transaction, Session.session_type)
        .join(Session, Session.session_id == Transaction.session_id)
        .order_by(Transaction.placed_at.desc())
        .limit(limit)
    )
    return [(transaction, session_type) for transaction, session_type in rows]