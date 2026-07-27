from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.enums import SessionType, TxnStatus


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    txn_id: int
    placed_at: datetime
    queue_date: date
    queue_number: int
    session_type: SessionType
    status: TxnStatus
    is_priority: bool
    item_count: int
    gross_amount: Decimal
    vatable_sales: Decimal
    vat_exempt_sales: Decimal
    vat_amount: Decimal
    discount_amount: Decimal
    net_amount: Decimal
