import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    KitchenQueue,
    MenuItem,
    Payment,
    PriorityVerificationLog,
    Session,
    SessionDevice,
    StaffAccount,
    Table,
    Transaction,
    TransactionItem,
)
from app.models.enums import (
    Language,
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    PrintStatus,
    SessionType,
    TxnStatus,
    UiMode,
)
from app.services.order import CartLine, price_order

MANILA = ZoneInfo("Asia/Manila")
SEED = 20260725
BUSINESS_DAYS = 16
PER_DAY = 3

PRIORITY_POOL = (
    "Wonton",
    "Steamed Rice",
    "Chicken Soup",
    "Skinless Wonton",
    "Wonton Noodle Soup",
    "Tea Eggs",
    "Braised Pork Set",
    "Xiaolongbao",
)
STANDARD_POOL = (
    "Peanut Butter Noodles",
    "Fried Noodles",
    "Fried Bihon",
    "Tea Eggs",
    "Wonton",
    "Steamed Rice",
    "Xiaolongbao",
    "Fried Wonton",
    "Intestine Noodle Soup",
    "Shuangcai Pork Noodle Soup",
)
GROUP_POOL = (
    "Braised Pork Feet",
    "Braised Pork",
    "Pickled Chicken Feet",
    "Steamed Rice",
    "Xiaolongbao",
    "Fried Noodles",
    "Wonton",
    "Braised Beef Set",
)

PLAN: tuple[tuple[SessionType, PriorityStatus], ...] = (
    (SessionType.STANDARD, PriorityStatus.STANDARD),
    (SessionType.PRIORITY, PriorityStatus.SENIOR),
    (SessionType.GROUP, PriorityStatus.STANDARD),
    (SessionType.STANDARD, PriorityStatus.STANDARD),
    (SessionType.PRIORITY, PriorityStatus.PWD),
    (SessionType.STANDARD, PriorityStatus.STANDARD),
    (SessionType.PRIORITY, PriorityStatus.PREGNANT),
    (SessionType.GROUP, PriorityStatus.SENIOR),
    (SessionType.STANDARD, PriorityStatus.STANDARD),
    (SessionType.PRIORITY, PriorityStatus.SENIOR),
    (SessionType.GROUP, PriorityStatus.STANDARD),
    (SessionType.STANDARD, PriorityStatus.STANDARD),
)

VOID_AT = (17, 34)

# Names on the presented OSCA / PWD cards. Invented for the seed, never real people.
CARDHOLDERS = (
    "Rosario A. Villanueva",
    "Eduardo B. Sarmiento",
    "Lucila M. Panganiban",
    "Alfredo T. Bacaltos",
    "Teresita R. Ombrog",
    "Gregorio L. Amarillo",
)
ISSUING_LGUS = ("Davao City", "Panabo City", "Tagum City", "Digos City")


def pool_for(session_type: SessionType) -> tuple[str, ...]:
    if session_type is SessionType.PRIORITY:
        return PRIORITY_POOL
    if session_type is SessionType.GROUP:
        return GROUP_POOL
    return STANDARD_POOL


async def seed_history(
    session: AsyncSession,
    tables: list[Table],
    staff: list[StaffAccount],
    items: dict[str, MenuItem],
) -> tuple[list[Transaction], list[Session]]:
    rng = random.Random(SEED)
    admin = next(account for account in staff if account.role.value == "admin")
    crew = next(account for account in staff if account.role.value == "service_crew")
    today = datetime.now(MANILA).date()

    transactions: list[Transaction] = []
    ordering_sessions: list[Session] = []
    index = 0

    for day_offset in range(BUSINESS_DAYS, 0, -1):
        queue_date = today - timedelta(days=day_offset)

        for slot in range(PER_DAY):
            session_type, declared = PLAN[index % len(PLAN)]
            table = tables[index % len(tables)]
            opened = datetime.combine(queue_date, datetime.min.time(), tzinfo=MANILA) + timedelta(
                hours=11, minutes=15 * slot + rng.randint(0, 10)
            )

            ordering_session = Session(
                table_id=table.table_id,
                started_at=opened,
                ended_at=opened + timedelta(minutes=rng.randint(25, 55)),
                declared_priority_status=declared,
                session_type=session_type,
                group_mode=session_type is SessionType.GROUP,
                ui_mode_used=(
                    UiMode.ACCESSIBLE if declared is not PriorityStatus.STANDARD else UiMode.STANDARD
                ),
                language_used=rng.choice(list(Language)),
                accessibility_accepted=declared is not PriorityStatus.STANDARD,
            )
            session.add(ordering_session)
            await session.flush()
            ordering_sessions.append(ordering_session)

            device_count = 2 if session_type is SessionType.GROUP else 1
            devices = [
                SessionDevice(
                    session_id=ordering_session.session_id,
                    joined_at=opened + timedelta(minutes=position * 2),
                    is_host=position == 0,
                )
                for position in range(device_count)
            ]
            session.add_all(devices)
            await session.flush()

            discount_applies = declared in (PriorityStatus.SENIOR, PriorityStatus.PWD)
            if declared is not PriorityStatus.STANDARD:
                # Entitlement follows the declaration, exactly as services/session.py
                # does it live — the discount is applied inside the ordering session.
                # Presenting an ID at the counter is a separate audit fact, recorded
                # here for the BIR trail, and only seniors and PWDs carry a card.
                presented = declared is not PriorityStatus.PREGNANT and rng.random() < 0.7
                session.add(
                    PriorityVerificationLog(
                        session_id=ordering_session.session_id,
                        declared_status=declared,
                        id_presented=presented,
                        id_last4=f"{rng.randint(0, 9999):04d}" if presented else None,
                        cardholder_name=rng.choice(CARDHOLDERS) if presented else None,
                        issuing_lgu=rng.choice(ISSUING_LGUS) if presented else None,
                        verified_by=crew.staff_id if presented else None,
                        verified_at=opened + timedelta(minutes=2) if presented else None,
                        discount_eligible=discount_applies,
                    )
                )
            else:
                discount_applies = False

            pool = pool_for(session_type)
            chosen = rng.sample(pool, rng.randint(2, 4))
            cart = [
                CartLine(
                    item_id=items[name].item_id,
                    quantity=rng.randint(1, 2),
                    unit_price=items[name].price,
                    discount_eligible=discount_applies and position == 0,
                    device_id=devices[position % device_count].device_id,
                )
                for position, name in enumerate(chosen)
            ]
            priced = price_order(cart)

            voided = index in VOID_AT
            placed = opened + timedelta(minutes=rng.randint(3, 12))

            transaction = Transaction(
                session_id=ordering_session.session_id,
                placed_at=placed,
                gross_amount=priced.gross_amount,
                vatable_sales=priced.vatable_sales,
                vat_exempt_sales=priced.vat_exempt_sales,
                vat_amount=priced.vat_amount,
                discount_amount=priced.discount_amount,
                net_amount=priced.net_amount,
                item_count=priced.item_count,
                is_priority=declared is not PriorityStatus.STANDARD,
                queue_date=queue_date,
                queue_number=slot + 1,
                status=TxnStatus.VOIDED if voided else TxnStatus.COMPLETED,
                voided_by=admin.staff_id if voided else None,
                void_reason="Customer cancelled before preparation." if voided else None,
                voided_at=placed + timedelta(minutes=2) if voided else None,
            )
            session.add(transaction)
            await session.flush()

            session.add_all(
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

            session.add(
                KitchenQueue(
                    txn_id=transaction.txn_id,
                    queue_position=slot + 1,
                    priority_skips_used=0,
                    updated_by=crew.staff_id,
                    entered_queue_at=placed,
                    prep_started_at=placed + timedelta(minutes=1),
                    completed_at=placed + timedelta(minutes=rng.randint(6, 15)),
                )
            )

            if not voided:
                session.add(
                    Payment(
                        txn_id=transaction.txn_id,
                        device_id=devices[0].device_id,
                        method=PaymentMethod.CASHIER,
                        amount=priced.net_amount,
                        discount_applied=priced.discount_amount,
                        status=PaymentStatus.PAID,
                        print_status=PrintStatus.SUCCESS,
                        paid_at=placed + timedelta(minutes=1),
                    )
                )

            transactions.append(transaction)
            index += 1

    await session.flush()
    return transactions, ordering_sessions
