from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import (
    AuditLog,
    KitchenQueue,
    MenuItem,
    Payment,
    Session,
    SessionDevice,
    Table,
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
    vatable: Decimal = Decimal("0.00")
    vat: Decimal = Decimal("0.00")
    vat_exempt: Decimal = Decimal("0.00")


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
                vatable=line_vatable,
                vat=line_vat,
                vat_exempt=line_exempt,
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
    """Reserve the next unique daily rolling queue number under an advisory lock held to commit."""
    await queue_service.ensure_unique_queue_numbers(db)
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext('queue_number'))")
    )
    highest = await db.scalar(
        select(func.coalesce(func.max(Transaction.queue_number), 0)).where(
            Transaction.queue_date == func.current_date()
        )
    )
    return highest + 1


def _resolve_lines(
    session_id: int, payer_ids: set[int], checkout_scope: str
) -> list[tuple[str, int, int]]:
    """Read the synced carts the scope covers. Each line keeps the person it belongs to."""
    if checkout_scope in ("table", "split"):
        return session_service.get_all_session_cart_lines(session_id)
    return session_service.get_group_cart_lines(session_id, payer_ids)


async def _payer_ids(db: AsyncSession, session_id: int, device: SessionDevice) -> set[int]:
    """The phone placing the order and the people it added without a phone."""
    return {device.device_id} | await session_service.companion_ids(
        db, session_id, device.device_id
    )


def _share_payments(
    transaction: Transaction,
    priced: "PricedOrder",
    payer: SessionDevice,
    method: PaymentMethod,
    companion_ids: set[int],
) -> tuple[list[Payment], Payment | None]:
    """One payment share per person on the order.

    The paying phone uses the method it chose. People without a phone pay at the
    cashier, where their ID is checked. Other phones choose how to pay later.
    """
    totals: dict[int, tuple[Decimal, Decimal]] = {}
    for line in priced.lines:
        owner = line.device_id or payer.device_id
        net, discount = totals.get(owner, (Decimal("0.00"), Decimal("0.00")))
        totals[owner] = (net + line.line_net, discount + line.discount_amount)

    payments: list[Payment] = []
    for owner, (net, discount) in totals.items():
        if net <= Decimal("0.00"):
            continue
        if owner == payer.device_id:
            owner_method = method
            reference = "CASHIER-CONFIRMED" if method is PaymentMethod.CASHIER else None
        elif owner in companion_ids:
            owner_method = PaymentMethod.CASHIER
            reference = "CASHIER-CONFIRMED"
        else:
            owner_method = PaymentMethod.CASHIER
            reference = "AWAITING-CHOICE"
        payments.append(
            Payment(
                txn_id=transaction.txn_id,
                device_id=owner,
                method=owner_method,
                amount=net,
                discount_applied=discount,
                status=PaymentStatus.PENDING,
                aggregator_ref=reference,
                paid_at=None,
            )
        )

    active = next((p for p in payments if p.device_id == payer.device_id), None)
    if active is None:
        active = next((p for p in payments if p.device_id in companion_ids), None)
    return payments, active


async def find_open_table_transaction(
    db: AsyncSession, session_id: int
) -> Transaction | None:
    ordering_session = await session_service.get_session(db, session_id)
    if not ordering_session.group_mode:
        return None

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
        if not payments:
            continue
        has_awaiting_choice = any(
            p.status != PaymentStatus.PAID and p.aggregator_ref == "AWAITING-CHOICE"
            for p in payments
        )
        has_pending_online = any(
            p.status != PaymentStatus.PAID and p.method is PaymentMethod.ONLINE
            for p in payments
        )
        has_unsettled_multi_split = len(payments) > 1 and any(
            p.status != PaymentStatus.PAID for p in payments
        )
        if has_awaiting_choice or has_pending_online or has_unsettled_multi_split:
            return txn
    return None


async def _ensure_in_kitchen_queue(
    db: AsyncSession, transaction: Transaction
) -> None:
    existing_slot = await db.scalar(
        select(KitchenQueue).where(KitchenQueue.txn_id == transaction.txn_id)
    )
    if existing_slot is None:
        await queue_service.place_in_queue(db, transaction)


async def _append_device_items_to_transaction(
    db: AsyncSession,
    transaction: Transaction,
    session_id: int,
    device: SessionDevice,
    live_lines: list[tuple[str, int]],
    method: PaymentMethod,
) -> Payment:
    eligible = await session_service.discount_devices(db, session_id)
    items_map = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(
                MenuItem.item_id.in_([item_id for item_id, _ in live_lines])
            )
        )
    }

    existing_tx_items = list(
        await db.scalars(
            select(TransactionItem).where(
                TransactionItem.txn_id == transaction.txn_id
            )
        )
    )
    combined_cart: list[CartLine] = []
    for tx_item in existing_tx_items:
        combined_cart.append(
            CartLine(
                item_id=tx_item.item_id,
                quantity=tx_item.quantity,
                unit_price=tx_item.unit_price,
                discount_eligible=tx_item.is_discounted,
                device_id=tx_item.device_id,
            )
        )

    new_cart_lines: list[CartLine] = []
    for item_id, qty in live_lines:
        item = items_map.get(item_id)
        if item is None:
            raise NotFoundError("An item in your cart is no longer on the menu.")
        if not item.is_available:
            raise BusinessRuleError(
                f"{item.name_en} has just sold out. Remove it to continue."
            )
        line_obj = CartLine(
            item_id=item.item_id,
            quantity=qty,
            unit_price=item.price,
            discount_eligible=device.device_id in eligible,
            device_id=device.device_id,
        )
        new_cart_lines.append(line_obj)
        combined_cart.append(line_obj)

    priced_new = price_order(new_cart_lines)
    priced_combined = price_order(combined_cart)

    for line in priced_new.lines:
        db.add(
            TransactionItem(
                txn_id=transaction.txn_id,
                item_id=line.item_id,
                device_id=device.device_id,
                quantity=line.quantity,
                unit_price=line.unit_price,
                subtotal=line.subtotal,
                is_discounted=line.is_discounted,
                discount_amount=line.discount_amount,
            )
        )

    transaction.gross_amount = priced_combined.gross_amount
    transaction.vatable_sales = priced_combined.vatable_sales
    transaction.vat_exempt_sales = priced_combined.vat_exempt_sales
    transaction.vat_amount = priced_combined.vat_amount
    transaction.discount_amount = priced_combined.discount_amount
    transaction.net_amount = priced_combined.net_amount
    transaction.item_count = priced_combined.item_count

    pay_row = Payment(
        txn_id=transaction.txn_id,
        device_id=device.device_id,
        method=method,
        amount=priced_new.net_amount,
        discount_applied=priced_new.discount_amount,
        status=PaymentStatus.PENDING,
        aggregator_ref="CASHIER-CONFIRMED" if method is PaymentMethod.CASHIER else None,
        paid_at=None,
    )
    db.add(pay_row)
    await _ensure_in_kitchen_queue(db, transaction)
    session_service.clear_device_cart(session_id, device.device_id)
    await db.commit()
    await db.refresh(transaction)
    await db.refresh(pay_row)
    return pay_row


async def build_cart(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int, int | None]],
    checkout_scope: str = "single",
) -> list[CartLine]:
    """Resolve requested item_ids against the live menu and the session's entitlement."""
    ordering_session = await session_service.get_session(db, session_id)
    if ordering_session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    if requested:
        await session_service.write_payer_carts(db, session_id, device, requested)
    payer_ids = await _payer_ids(db, session_id, device)

    if checkout_scope in ("split", "table"):
        open_txn = await find_open_table_transaction(db, session_id)
        if open_txn is not None:
            tx_rows = list(
                await db.scalars(
                    select(TransactionItem).where(
                        TransactionItem.txn_id == open_txn.txn_id
                    )
                )
            )
            if checkout_scope == "split":
                my_tx_rows = [r for r in tx_rows if r.device_id in payer_ids]
                if my_tx_rows:
                    return [
                        CartLine(
                            item_id=r.item_id,
                            quantity=r.quantity,
                            unit_price=r.unit_price,
                            discount_eligible=r.is_discounted,
                            device_id=r.device_id,
                        )
                        for r in my_tx_rows
                    ]
            else:
                payments = list(
                    await db.scalars(
                        select(Payment).where(Payment.txn_id == open_txn.txn_id)
                    )
                )
                paid_devices = {
                    p.device_id
                    for p in payments
                    if p.status is PaymentStatus.PAID and p.device_id is not None
                }
                unpaid_tx_rows = [
                    r for r in tx_rows if r.device_id not in paid_devices
                ]
                if unpaid_tx_rows:
                    return [
                        CartLine(
                            item_id=r.item_id,
                            quantity=r.quantity,
                            unit_price=r.unit_price,
                            discount_eligible=r.is_discounted,
                            device_id=r.device_id,
                        )
                        for r in unpaid_tx_rows
                    ]

    resolved = _resolve_lines(session_id, payer_ids, checkout_scope)
    if not resolved:
        raise BusinessRuleError("Your cart is empty. Add an item before checking out.")

    eligible = await session_service.discount_devices(db, session_id)
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
                discount_eligible=line_device_id in eligible,
                device_id=line_device_id,
            )
        )

    return lines


async def quote_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int, int | None]],
    checkout_scope: str = "single",
) -> PricedOrder:
    """Price a cart without recording anything, so checkout can show tax and discount."""
    return price_order(await build_cart(db, session_id, device, requested, checkout_scope))


async def place_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int, int | None]],
    method: PaymentMethod,
    checkout_scope: str = "single",
) -> tuple[Transaction, Payment]:
    """Price, queue and record an order (single, full-table, or multi-phone split)."""
    ordering_session = await session_service.get_session(db, session_id)
    if ordering_session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    if requested:
        await session_service.write_payer_carts(db, session_id, device, requested)
    payer_ids = await _payer_ids(db, session_id, device)
    companion_ids = payer_ids - {device.device_id}

    effective_scope = checkout_scope
    if ordering_session.group_mode and effective_scope == "single":
        effective_scope = "split"

    if method is PaymentMethod.ONLINE:
        pending = await session_service.pending_discount_devices(db, session_id)
        covered = pending if effective_scope == "table" else pending & {device.device_id}
        if covered:
            raise BusinessRuleError(
                "Discounted orders are paid at the cashier, where the ID is checked."
            )

    existing_txn = await find_open_table_transaction(db, session_id)

    if effective_scope == "split" and existing_txn is not None:
        companion_payment: Payment | None = None
        for companion_id in sorted(companion_ids):
            companion_lines = session_service.get_device_cart_lines(session_id, companion_id)
            if companion_lines:
                companion = await db.get(SessionDevice, companion_id)
                companion_payment = await _append_device_items_to_transaction(
                    db, existing_txn, session_id, companion, companion_lines, PaymentMethod.CASHIER
                )

        my_payment = await db.scalar(
            select(Payment).where(
                Payment.txn_id == existing_txn.txn_id,
                Payment.device_id == device.device_id,
            )
        )
        my_live_lines = session_service.get_device_cart_lines(session_id, device.device_id)

        if my_payment is None:
            if not my_live_lines and companion_payment is not None:
                return existing_txn, companion_payment
            if not my_live_lines:
                raise BusinessRuleError(
                    "Add an item to your cart first, or choose Pay Remaining Balance to settle the table."
                )
            my_payment = await _append_device_items_to_transaction(
                db, existing_txn, session_id, device, my_live_lines, method
            )
            return existing_txn, my_payment

        if my_payment.status is PaymentStatus.PAID:
            if my_live_lines:
                my_payment = await _append_device_items_to_transaction(
                    db, existing_txn, session_id, device, my_live_lines, method
                )
            return existing_txn, my_payment

        if my_payment.aggregator_ref == "CASHIER-CONFIRMED" and my_live_lines:
            existing_txn = None
        else:
            # Update
            my_payment.method = method
            if method is PaymentMethod.CASHIER:
                my_payment.aggregator_ref = "CASHIER-CONFIRMED"
            await _ensure_in_kitchen_queue(db, existing_txn)
            session_service.clear_device_cart(session_id, device.device_id)
            await db.commit()
            await db.refresh(existing_txn)
            await db.refresh(my_payment)
            return existing_txn, my_payment

    if effective_scope == "table" and existing_txn is not None:
        for dev_id in list(session_service._TABLE_CARTS.get(session_id, {}).keys()):
            dev_lines = session_service.get_device_cart_lines(session_id, dev_id)
            existing_dev_items = list(
                await db.scalars(
                    select(TransactionItem).where(
                        TransactionItem.txn_id == existing_txn.txn_id,
                        TransactionItem.device_id == dev_id,
                    )
                )
            )
            if dev_lines and not existing_dev_items:
                dev_obj = await db.get(SessionDevice, dev_id)
                if dev_obj is not None:
                    await _append_device_items_to_transaction(
                        db, existing_txn, session_id, dev_obj, dev_lines, method
                    )

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
            await _ensure_in_kitchen_queue(db, existing_txn)
            session_service.clear_table_cart(session_id)
            await db.commit()
            await db.refresh(existing_txn)
            await db.refresh(primary)
            return existing_txn, primary

    resolved = _resolve_lines(session_id, payer_ids, effective_scope)
    if not resolved:
        raise BusinessRuleError("Your cart is empty. Add an item before checking out.")
    if (
        method is PaymentMethod.ONLINE
        and effective_scope != "table"
        and not any(owner == device.device_id for _, _, owner in resolved)
    ):
        raise BusinessRuleError(
            "Only your own items can be paid online. Items for people without a phone "
            "are paid at the cashier, where their ID is checked."
        )

    eligible = await session_service.discount_devices(db, session_id)
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
                discount_eligible=line_device_id in eligible,
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

    await queue_service.place_in_queue(db, transaction)

    if effective_scope == "table":
        active_payment = Payment(
            txn_id=transaction.txn_id,
            device_id=device.device_id,
            method=method,
            amount=priced.net_amount,
            discount_applied=priced.discount_amount,
            status=PaymentStatus.PENDING,
            aggregator_ref="CASHIER-CONFIRMED" if method is PaymentMethod.CASHIER else None,
            paid_at=None,
        )
        db.add(active_payment)
        session_service.clear_table_cart(session_id)
    else:
        shares, active_payment = _share_payments(
            transaction, priced, device, method, companion_ids
        )
        db.add_all(shares)
        if effective_scope == "split":
            session_service.clear_table_cart(session_id)
        else:
            for payer_id in payer_ids:
                session_service.clear_device_cart(session_id, payer_id)

    # Commit
    await db.commit()
    await db.refresh(transaction)
    if active_payment is not None:
        await db.refresh(active_payment)
    return transaction, active_payment


REPRICED_COLUMNS = (
    "gross_amount",
    "vatable_sales",
    "vat_exempt_sales",
    "vat_amount",
    "discount_amount",
    "net_amount",
    "item_count",
)


async def reprice_device_lines(
    db: AsyncSession, transaction: Transaction, device_id: int
) -> None:
    """Re-price one phone's lines after the cashier's ID check changes its entitlement.

    Settled money is never touched: if that phone's share is already paid, or nothing on
    the order is unpaid, the stored pricing stands. The difference lands on the phone's
    own unpaid share, or on the single unpaid share that covers the whole table.
    """
    payments = list(
        await db.scalars(select(Payment).where(Payment.txn_id == transaction.txn_id))
    )
    own = [p for p in payments if p.device_id == device_id]
    unpaid = [p for p in payments if p.status is not PaymentStatus.PAID]
    if not unpaid or any(p.status is PaymentStatus.PAID for p in own):
        return

    target = next((p for p in own if p.status is not PaymentStatus.PAID), None)
    if target is None:
        if len(unpaid) != 1:
            raise BusinessRuleError(
                "This order's payment shares cannot be matched to that phone. "
                "Void the order and enter it again."
            )
        target = unpaid[0]

    eligible = device_id in await session_service.discount_devices(db, transaction.session_id)
    rows = list(
        await db.scalars(
            select(TransactionItem)
            .where(TransactionItem.txn_id == transaction.txn_id)
            .order_by(TransactionItem.txi_id)
        )
    )
    priced = price_order(
        [
            CartLine(
                item_id=row.item_id,
                quantity=row.quantity,
                unit_price=row.unit_price,
                discount_eligible=eligible if row.device_id == device_id else row.is_discounted,
                device_id=row.device_id,
            )
            for row in rows
        ]
    )

    for row, line in zip(rows, priced.lines, strict=True):
        if row.device_id == device_id:
            row.is_discounted = line.is_discounted
            row.discount_amount = line.discount_amount

    target.amount += priced.net_amount - transaction.net_amount
    target.discount_applied += priced.discount_amount - transaction.discount_amount

    for column in REPRICED_COLUMNS:
        setattr(transaction, column, getattr(priced, column))


def share_label(label: "session_service.DeviceLabel | None", current_device_id: int | None) -> dict:
    """How a payment share names its person: a phone number, or the person a phone added."""
    if label is None:
        return {"device_number": None, "is_host": False}
    return {
        "device_number": label.device_number,
        "is_host": label.is_host,
        "display_name": label.display_name,
        "is_companion": label.managed_by_device_id is not None,
        "managed_by_me": (
            label.managed_by_device_id is not None
            and label.managed_by_device_id == current_device_id
        ),
    }


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
    await queue_service.ensure_unique_queue_numbers(db)
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

    labels = await session_service.device_labels(db, {session_id})

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
                **share_label(labels.get(p.device_id), current_device_id),
                "is_me": p.device_id == current_device_id,
                "amount": p.amount,
                "method": p.method,
                "status": p.status,
            }
            for p in txn_payments
        ]

        is_held_split = shares_total > 1 and overall_status is not PaymentStatus.PAID

        result.append(
            {
                "txn_id": txn.txn_id,
                "queue_number": txn.queue_number,
                "status": txn.status,
                "is_priority": txn.is_priority,
                "queue_position": (
                    slots[txn.txn_id].queue_position
                    if txn.txn_id in slots
                    and slots[txn.txn_id].completed_at is None
                    and not is_held_split
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


# Read
async def list_transactions(
    db: AsyncSession, limit: int = 100
) -> list[tuple[Transaction, Session, int]]:
    """List recent transactions with session metadata and table number, newest first."""
    await queue_service.ensure_unique_queue_numbers(db)
    rows = await db.execute(
        select(Transaction, Session, Table.table_number)
        .join(Session, Session.session_id == Transaction.session_id)
        .join(Table, Table.table_id == Session.table_id)
        .order_by(Transaction.placed_at.desc())
        .limit(limit)
    )
    return [(transaction, session, table_number) for transaction, session, table_number in rows]


# Update
async def void_transaction(
    db: AsyncSession, txn_id: int, reason: str, staff_id: str
) -> Transaction:
    """Void a transaction, remove it from active kitchen queue, and append to audit_log."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That transaction no longer exists.")

    if transaction.status is TxnStatus.VOIDED:
        raise BusinessRuleError(
            f"Order Q-{transaction.queue_number:03d} is already voided."
        )

    previous_status = transaction.status.value
    now = datetime.now(UTC)

    transaction.status = TxnStatus.VOIDED
    transaction.voided_by = staff_id
    transaction.void_reason = reason.strip()
    transaction.voided_at = now

    slot = await db.scalar(select(KitchenQueue).where(KitchenQueue.txn_id == txn_id))
    if slot is not None and slot.completed_at is None:
        slot.completed_at = now
        slot.updated_by = staff_id

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="txn_void",
            entity_type="transaction",
            entity_id=str(txn_id),
            before_state={"status": previous_status},
            after_state={
                "status": TxnStatus.VOIDED.value,
                "void_reason": transaction.void_reason,
                "voided_by": staff_id,
            },
        )
    )

    await db.commit()
    await db.refresh(transaction)
    return transaction