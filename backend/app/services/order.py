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
from app.models.enums import PaymentMethod, PaymentStatus, PriorityStatus
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


async def build_cart(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
) -> list[CartLine]:
    """Resolve a requested cart into priceable lines, validating session and stock."""
    if not requested:
        raise BusinessRuleError("Your cart is empty. Add an item before checking out.")

    ordering_session = await session_service.get_session(db, session_id)
    if ordering_session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    eligible = await session_service.discount_eligible(db, session_id)
    items = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(MenuItem.item_id.in_([item_id for item_id, _ in requested]))
        )
    }

    lines: list[CartLine] = []
    for item_id, quantity in requested:
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
                device_id=device.device_id,
            )
        )

    return lines


async def quote_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
) -> PricedOrder:
    """Price a cart without recording anything, so checkout can show tax and discount."""
    return price_order(await build_cart(db, session_id, device, requested))


async def place_order(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    requested: list[tuple[str, int]],
    method: PaymentMethod,
) -> Transaction:
    """Price, queue and record an order in one database transaction."""
    lines = await build_cart(db, session_id, device, requested)
    ordering_session = await session_service.get_session(db, session_id)
    priced = price_order(lines)
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

    db.add(
        Payment(
            txn_id=transaction.txn_id,
            device_id=device.device_id,
            method=method,
            amount=priced.net_amount,
            discount_applied=priced.discount_amount,
            status=PaymentStatus.PENDING,
            aggregator_ref=None,
            paid_at=None,
        )
    )

    # Commit
    await db.commit()
    await db.refresh(transaction)
    return transaction


async def get_receipt(
    db: AsyncSession, txn_id: int
) -> tuple[Transaction, list[tuple[TransactionItem, MenuItem]], Payment]:
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That receipt is no longer available.")

    rows = await db.execute(
        select(TransactionItem, MenuItem)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(TransactionItem.txn_id == txn_id)
        .order_by(TransactionItem.txi_id)
    )
    payment = await db.scalar(select(Payment).where(Payment.txn_id == txn_id))
    return transaction, [(line, item) for line, item in rows], payment


async def session_order_status(db: AsyncSession, session_id: int) -> list[dict]:
    """List this table's orders and their live queue position, newest first."""
    rows = await db.execute(
        select(Transaction, KitchenQueue, Payment)
        .outerjoin(KitchenQueue, KitchenQueue.txn_id == Transaction.txn_id)
        .outerjoin(Payment, Payment.txn_id == Transaction.txn_id)
        .where(Transaction.session_id == session_id)
        .order_by(Transaction.placed_at.desc())
    )
    return [
        {
            "txn_id": txn.txn_id,
            "queue_number": txn.queue_number,
            "status": txn.status,
            "is_priority": txn.is_priority,
            "queue_position": (
                slot.queue_position if slot is not None and slot.completed_at is None else None
            ),
            "net_amount": txn.net_amount,
            "payment_status": payment.status,
        }
        for txn, slot, payment in rows
    ]


async def list_transactions(db: AsyncSession, limit: int = 100) -> list[tuple[Transaction, str]]:
    """List recent transactions with each one's Apriori segment, newest first."""
    rows = await db.execute(
        select(Transaction, Session.session_type)
        .join(Session, Session.session_id == Transaction.session_id)
        .order_by(Transaction.placed_at.desc())
        .limit(limit)
    )
    return [(transaction, session_type) for transaction, session_type in rows]