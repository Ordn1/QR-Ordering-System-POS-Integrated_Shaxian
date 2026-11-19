"""Order history for the demo, written before the Apriori job mines it.

If seeds/transactions.csv (or backend/transactions.csv) exists, the history is loaded
from it. Otherwise 48 orders are generated from a fixed random seed, so the same
history, and therefore the same mined rules, come back on every rebuild.
"""

import csv
import random
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any
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
    "Rice",
    "Chicken Soup",
    "Skinless Wonton",
    "Wonton Noodles Soup",
    "Tea Eggs",
    "Braised Pork with Rice and Soup",
    "Mini Siopao",
)
STANDARD_POOL = (
    "Peanut Butter Noodles",
    "Fried Noodles",
    "Fried Bihon",
    "Tea Eggs",
    "Wonton",
    "Rice",
    "Mini Siopao",
    "Fried Wonton",
    "Intestine Noodles Soup",
    "Sauerkraut Pork Noodle Soup",
)
GROUP_POOL = (
    "Braised Pork Feet",
    "Braised Pork",
    "Pickled Chicken Feet",
    "Rice",
    "Mini Siopao",
    "Fried Noodles",
    "Wonton",
    "Braised Beef with Rice and Soup",
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

CSV_CANDIDATES = (
    Path(__file__).resolve().parent / "transactions.csv",
    Path(__file__).resolve().parents[1] / "transactions.csv",
    Path(__file__).resolve().parents[2] / "transactions.csv",
)


def _locate_csv() -> Path | None:
    for candidate in CSV_CANDIDATES:
        if candidate.exists():
            return candidate
    return None


def _solve_quantities(
    names: list[str],
    prices: list[Decimal],
    target_count: int,
    target_gross: Decimal,
) -> list[int]:
    k = len(names)
    extra_count = target_count - k
    base_gross = sum(prices, Decimal("0.00"))
    extra_gross = target_gross - base_gross
    if extra_count <= 0 and extra_gross == Decimal("0.00"):
        return [1] * k

    additions = [0] * k

    def dfs(idx: int, rem_count: int, rem_gross: Decimal) -> bool:
        if rem_count == 0:
            return rem_gross == Decimal("0.00")
        if idx == k or rem_gross < Decimal("0.00"):
            return False
        max_add = min(rem_count, int(rem_gross // prices[idx]))
        for add in range(max_add, -1, -1):
            additions[idx] = add
            if dfs(idx + 1, rem_count - add, rem_gross - add * prices[idx]):
                return True
        additions[idx] = 0
        return False

    if dfs(0, max(0, extra_count), extra_gross):
        return [1 + x for x in additions]
    return [1] * (k - 1) + [1 + max(0, extra_count)]


def describe_source() -> str:
    csv_path = _locate_csv()
    if csv_path is not None:
        return f"loaded from {csv_path.name}"
    return "generated history, not real diners"


async def seed_history(
    session: AsyncSession,
    tables: list[Table],
    staff: list[StaffAccount],
    items: dict[str, MenuItem],
) -> tuple[list[Transaction], list[Session]]:
    csv_path = _locate_csv()
    if csv_path is not None:
        return await _seed_from_csv(session, tables, staff, items, csv_path)
    return await _seed_generated(session, tables, staff, items)


def pool_for(session_type: SessionType) -> tuple[str, ...]:
    if session_type is SessionType.PRIORITY:
        return PRIORITY_POOL
    if session_type is SessionType.GROUP:
        return GROUP_POOL
    return STANDARD_POOL


async def _seed_generated(
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

            # The declaring phone is the host. Its discount stands only if the cashier
            # saw a valid ID, exactly as services/verification.py settles it live; a
            # senior or PWD who showed none is a rejected check at full VAT.
            declarer = devices[0]
            claims_discount = declared in (PriorityStatus.SENIOR, PriorityStatus.PWD)
            discount_applies = False
            if declared is not PriorityStatus.STANDARD:
                presented = declared is not PriorityStatus.PREGNANT and rng.random() < 0.7
                discount_applies = claims_discount and presented
                checked = claims_discount
                session.add(
                    PriorityVerificationLog(
                        session_id=ordering_session.session_id,
                        device_id=declarer.device_id,
                        declared_status=declared,
                        id_presented=presented,
                        id_last4=f"{rng.randint(0, 9999):04d}" if presented else None,
                        cardholder_name=rng.choice(CARDHOLDERS) if presented else None,
                        issuing_lgu=rng.choice(ISSUING_LGUS) if presented else None,
                        verified_by=crew.staff_id if checked else None,
                        verified_at=opened + timedelta(minutes=2) if checked else None,
                        discount_eligible=discount_applies,
                    )
                )

            pool = pool_for(session_type)
            chosen = rng.sample(pool, rng.randint(2, 4))
            cart = [
                CartLine(
                    item_id=items[name].item_id,
                    quantity=rng.randint(1, 2),
                    unit_price=items[name].price,
                    discount_eligible=(
                        discount_applies and devices[position % device_count] is declarer
                    ),
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


async def _seed_from_csv(
    session: AsyncSession,
    tables: list[Table],
    staff: list[StaffAccount],
    items: dict[str, MenuItem],
    csv_path: Path,
) -> tuple[list[Transaction], list[Session]]:
    rng = random.Random(SEED)

    admin = next(account for account in staff if account.role.value == "admin")
    crew = next(account for account in staff if account.role.value == "service_crew")
    tables_by_number = {table.table_number: table for table in tables}

    with csv_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    parsed_rows: list[dict[str, Any]] = []
    ordering_sessions: list[Session] = []

    for row in rows:
        session_type = SessionType(row["session_type"].strip())
        declared = PriorityStatus(row["declared_priority_status"].strip())
        table_number = int(row["table_number"])
        table = tables_by_number.get(table_number, tables[0])
        device_count = max(1, int(row["devices"]))
        placed = datetime.fromisoformat(row["placed_at"].strip())
        opened = placed - timedelta(minutes=rng.randint(4, 10))
        ended = placed + timedelta(minutes=rng.randint(20, 45))
        queue_number = int(row["queue_number"])
        target_count = int(row["item_count"])
        target_gross = Decimal(row["gross_amount"])
        voided = row["status"].strip() == "voided"
        item_names = [
            name.strip() for name in row["items"].split("|") if name.strip()
        ]

        ordering_session = Session(
            table_id=table.table_id,
            started_at=opened,
            ended_at=ended,
            declared_priority_status=declared,
            session_type=session_type,
            group_mode=session_type is SessionType.GROUP or device_count > 1,
            ui_mode_used=(
                UiMode.ACCESSIBLE
                if declared is not PriorityStatus.STANDARD
                else UiMode.STANDARD
            ),
            language_used=rng.choice(list(Language)),
            accessibility_accepted=declared is not PriorityStatus.STANDARD,
        )
        ordering_sessions.append(ordering_session)
        parsed_rows.append(
            {
                "ordering_session": ordering_session,
                "declared": declared,
                "device_count": device_count,
                "placed": placed,
                "opened": opened,
                "queue_number": queue_number,
                "target_count": target_count,
                "target_gross": target_gross,
                "voided": voided,
                "item_names": item_names,
            }
        )

    session.add_all(ordering_sessions)
    await session.flush()

    all_devices: list[SessionDevice] = []
    for meta in parsed_rows:
        ordering_session = meta["ordering_session"]
        devices = [
            SessionDevice(
                session_id=ordering_session.session_id,
                joined_at=meta["opened"] + timedelta(minutes=position),
                is_host=position == 0,
            )
            for position in range(meta["device_count"])
        ]
        meta["devices"] = devices
        all_devices.extend(devices)

    session.add_all(all_devices)
    await session.flush()

    # The declaring phone is the host. Its discount stands only if the cashier saw a
    # valid ID, as services/verification.py settles it live; a senior or PWD who
    # showed none is a rejected check at full VAT.
    verifications: list[PriorityVerificationLog] = []
    for meta in parsed_rows:
        ordering_session = meta["ordering_session"]
        opened = meta["opened"]
        declared = meta["declared"]
        claims_discount = declared in (PriorityStatus.SENIOR, PriorityStatus.PWD)
        discount_applies = False
        if declared is not PriorityStatus.STANDARD:
            presented = declared is not PriorityStatus.PREGNANT and rng.random() < 0.85
            discount_applies = claims_discount and presented
            verifications.append(
                PriorityVerificationLog(
                    session_id=ordering_session.session_id,
                    device_id=meta["devices"][0].device_id,
                    declared_status=declared,
                    id_presented=presented,
                    id_last4=f"{rng.randint(0, 9999):04d}" if presented else None,
                    cardholder_name=rng.choice(CARDHOLDERS) if presented else None,
                    issuing_lgu=rng.choice(ISSUING_LGUS) if presented else None,
                    verified_by=crew.staff_id if claims_discount else None,
                    verified_at=opened + timedelta(minutes=2) if claims_discount else None,
                    discount_eligible=discount_applies,
                )
            )
        meta["discount_applies"] = discount_applies

    session.add_all(verifications)
    await session.flush()

    transactions: list[Transaction] = []
    for meta in parsed_rows:
        ordering_session = meta["ordering_session"]
        devices = meta["devices"]
        device_count = meta["device_count"]
        discount_applies = meta["discount_applies"]
        item_names = meta["item_names"]
        item_prices = [items[name].price for name in item_names]
        quantities = _solve_quantities(
            item_names, item_prices, meta["target_count"], meta["target_gross"]
        )

        cart = [
            CartLine(
                item_id=items[name].item_id,
                quantity=qty,
                unit_price=items[name].price,
                discount_eligible=(
                    discount_applies and devices[position % device_count] is devices[0]
                ),
                device_id=devices[position % device_count].device_id,
            )
            for position, (name, qty) in enumerate(zip(item_names, quantities))
        ]
        priced = price_order(cart)
        meta["priced"] = priced

        placed = meta["placed"]
        voided = meta["voided"]
        declared = meta["declared"]

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
            queue_date=placed.astimezone(MANILA).date(),
            queue_number=meta["queue_number"],
            status=TxnStatus.VOIDED if voided else TxnStatus.COMPLETED,
            voided_by=admin.staff_id if voided else None,
            void_reason="Customer cancelled before preparation." if voided else None,
            voided_at=placed + timedelta(minutes=2) if voided else None,
        )
        meta["transaction"] = transaction
        transactions.append(transaction)

    session.add_all(transactions)
    await session.flush()

    all_tx_items: list[TransactionItem] = []
    all_queues: list[KitchenQueue] = []
    all_payments: list[Payment] = []

    for meta in parsed_rows:
        transaction = meta["transaction"]
        priced = meta["priced"]
        placed = meta["placed"]
        voided = meta["voided"]
        devices = meta["devices"]

        for line in priced.lines:
            all_tx_items.append(
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
            )

        all_queues.append(
            KitchenQueue(
                txn_id=transaction.txn_id,
                queue_position=meta["queue_number"],
                priority_skips_used=0,
                updated_by=crew.staff_id,
                entered_queue_at=placed,
                prep_started_at=placed + timedelta(minutes=1),
                completed_at=placed + timedelta(minutes=rng.randint(6, 15)),
            )
        )

        if not voided:
            all_payments.append(
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

    session.add_all(all_tx_items)
    session.add_all(all_queues)
    session.add_all(all_payments)
    await session.flush()
    return transactions, ordering_sessions