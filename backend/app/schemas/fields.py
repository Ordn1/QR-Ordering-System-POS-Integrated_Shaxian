import re
from decimal import Decimal
from typing import Annotated, Any

from pydantic import AfterValidator, Field, StringConstraints

LATIN = "A-Za-zÀ-ÖØ-öø-ÿ"

ALPHA = rf"^[{LATIN} '\-.]+$"
ALPHANUMERIC = rf"^[{LATIN}0-9 '\-.()]+$"
NUMERIC = r"^[0-9]+$"
CURRENCY = r"^[0-9]+(\.[0-9]{1,2})?$"

FORBIDDEN_RANGES = (
    (0x0000, 0x001F),
    (0x007F, 0x007F),
    (0x200B, 0x200D),
    (0x2060, 0x2060),
    (0xFE0F, 0xFE0F),
    (0xFEFF, 0xFEFF),
    (0x2600, 0x27BF),
    (0x2B00, 0x2BFF),
    (0x1F000, 0x1FAFF),
)

FORBIDDEN = re.compile(
    "[" + "".join(f"{chr(low)}-{chr(high)}" for low, high in FORBIDDEN_RANGES) + "]"
)


def reject_forbidden(value: str) -> str:
    if FORBIDDEN.search(value):
        raise ValueError("Emoji, control characters and zero-width characters are not allowed.")
    return value


def sized(max_length: int, pattern: str) -> Any:
    return Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=1,
            max_length=max_length,
            pattern=pattern,
        ),
        AfterValidator(reject_forbidden),
    ]


def freetext(max_length: int) -> Any:
    return Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=max_length),
        AfterValidator(reject_forbidden),
    ]


SmallPositive = Annotated[int, Field(ge=1, le=32767)]
SmallNonNegative = Annotated[int, Field(ge=0, le=32767)]
Price = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=2)]
