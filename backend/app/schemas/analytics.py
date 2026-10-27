from pydantic import BaseModel


class DayPoint(BaseModel):
    date: str
    orders: int
    net: float


class ItemPoint(BaseModel):
    name: str
    units: int
    revenue: float


class SegmentPoint(BaseModel):
    segment: str
    orders: int


class PriorityPoint(BaseModel):
    status: str
    sessions: int


class VerificationRow(BaseModel):
    log_id: int
    session_id: int
    declared_status: str
    id_presented: bool
    id_last4: str | None
    cardholder_name: str | None
    issuing_lgu: str | None
    verified_by: str | None
    verified_at: str | None
    discount_eligible: bool
    declared_at: str


class SegmentReportRead(BaseModel):
    segment: str
    baskets: int
    itemsets: int
    rules: int


class AprioriRunRead(BaseModel):
    min_support: float
    min_lift: float
    generated_at: str
    segments: list[SegmentReportRead]


class AprioriRuleRow(BaseModel):
    rule_id: str
    session_type: str
    antecedents: list[str]
    consequents: list[str]
    support: float
    confidence: float
    lift: float
    generated_at: str


class Funnel(BaseModel):
    shown: int
    accepted: int
    dismissed: int


class Headline(BaseModel):
    orders: int
    gross_amount: float
    net_amount: float
    vat_amount: float
    discount_amount: float
    average_order: float
    priority_share: float
    priority_declarations: int
    sessions: int
    trigger_rate: float


class AnalyticsSummary(BaseModel):
    headline: Headline
    sales_by_day: list[DayPoint]
    top_items: list[ItemPoint]
    segment_mix: list[SegmentPoint]
    priority_mix: list[PriorityPoint]
    recommendation_funnel: Funnel
    apriori_rules: list[AprioriRuleRow] = []