from enum import Enum

from sqlalchemy.dialects import postgresql


class OccupancyStatus(str, Enum):
    VACANT = "vacant"
    OCCUPIED = "occupied"
    RESERVED = "reserved"


class StaffRole(str, Enum):
    SERVICE_CREW = "service_crew"
    ADMIN = "admin"


class PriorityStatus(str, Enum):
    STANDARD = "standard"
    SENIOR = "senior"
    PWD = "pwd"
    PREGNANT = "pregnant"


class SessionType(str, Enum):
    STANDARD = "standard"
    PRIORITY = "priority"
    GROUP = "group"


class UiMode(str, Enum):
    STANDARD = "standard"
    ACCESSIBLE = "accessible"


class Language(str, Enum):
    EN = "en"
    FIL = "fil"
    BIS = "bis"


class TxnStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    READY = "ready"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    VOIDED = "voided"


class PaymentMethod(str, Enum):
    ONLINE = "online"
    CASHIER = "cashier"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class PrintStatus(str, Enum):
    SUCCESS = "success"
    FAILED = "failed"


class EventType(str, Enum):
    DWELL_TIMEOUT = "dwell_timeout"
    BACK_NAVIGATION = "back_navigation"
    CART_ABANDON = "cart_abandon"
    CATEGORY_REVISIT = "category_revisit"
    RECOMMENDATION_SHOWN = "recommendation_shown"
    RECOMMENDATION_ACCEPTED = "recommendation_accepted"
    RECOMMENDATION_DISMISSED = "recommendation_dismissed"
    ZOOM_DETECTED = "zoom_detected"
    MISSED_TAP = "missed_tap"
    ASSIST_OFFERED = "assist_offered"
    ASSIST_ACCEPTED = "assist_accepted"
    ASSIST_DECLINED = "assist_declined"
    DISPLAY_CHANGED = "display_changed"
    CREW_CALLED = "crew_called"
    CODE_ENTERED = "code_entered"


class MenuSize(str, Enum):
    GRID = "grid"
    LIST = "list"
    LARGE = "large"


class AssistanceReason(str, Enum):
    ASKED = "asked"
    OFFERED = "offered"


class SessionEndReason(str, Enum):
    COMPLETED = "completed"
    TIMEOUT = "timeout"
    NEW_CUSTOMER_OVERRIDE = "new_customer_override"
    STAFF_RESET = "staff_reset"


class Tender(str, Enum):
    CASH = "cash"
    GCASH = "gcash"
    CARD = "card"


def pg_enum(python_enum: type[Enum], name: str) -> postgresql.ENUM:
    return postgresql.ENUM(
        python_enum,
        name=name,
        create_type=False,
        values_callable=lambda enum_cls: [member.value for member in enum_cls],
    )


OCCUPANCY_STATUS = pg_enum(OccupancyStatus, "occupancy_status_enum")
STAFF_ROLE = pg_enum(StaffRole, "staff_role_enum")
PRIORITY_STATUS = pg_enum(PriorityStatus, "priority_status_enum")
SESSION_TYPE = pg_enum(SessionType, "session_type_enum")
UI_MODE = pg_enum(UiMode, "ui_mode_enum")
LANGUAGE = pg_enum(Language, "language_enum")
TXN_STATUS = pg_enum(TxnStatus, "txn_status_enum")
PAYMENT_METHOD = pg_enum(PaymentMethod, "payment_method_enum")
PAYMENT_STATUS = pg_enum(PaymentStatus, "payment_status_enum")
PRINT_STATUS = pg_enum(PrintStatus, "print_status_enum")
EVENT_TYPE = pg_enum(EventType, "event_type_enum")
MENU_SIZE = pg_enum(MenuSize, "menu_size_enum")
ASSISTANCE_REASON = pg_enum(AssistanceReason, "assistance_reason_enum")
SESSION_END_REASON = pg_enum(SessionEndReason, "session_end_reason_enum")
TENDER = pg_enum(Tender, "tender_enum")

ENUM_DEFINITIONS: tuple[tuple[str, tuple[str, ...]], ...] = tuple(
    (pg_type.name, tuple(member.value for member in pg_type.enum_class))
    for pg_type in (
        OCCUPANCY_STATUS,
        STAFF_ROLE,
        PRIORITY_STATUS,
        SESSION_TYPE,
        UI_MODE,
        LANGUAGE,
        TXN_STATUS,
        PAYMENT_METHOD,
        PAYMENT_STATUS,
        PRINT_STATUS,
        EVENT_TYPE,
        MENU_SIZE,
        ASSISTANCE_REASON,
        SESSION_END_REASON,
        TENDER,
    )
)
