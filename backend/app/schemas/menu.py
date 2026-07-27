from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.fields import (
    ALPHANUMERIC,
    Price,
    SmallNonNegative,
    freetext,
    sized,
)

CategoryName = sized(40, ALPHANUMERIC)
ItemName = sized(60, ALPHANUMERIC)
Description = freetext(160)
Allergens = freetext(120)
DietaryFlags = freetext(60)
ImageFilename = freetext(80)


class CategoryWrite(BaseModel):
    name_en: CategoryName
    name_fil: CategoryName
    name_bis: CategoryName
    display_order: SmallNonNegative = 0
    is_active: bool = True


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cat_id: str
    name_en: str
    name_fil: str
    name_bis: str
    display_order: int
    is_active: bool


class MenuItemWrite(BaseModel):
    cat_id: str
    name_en: ItemName
    name_fil: ItemName
    name_bis: ItemName
    description_en: Description | None = None
    description_fil: Description | None = None
    description_bis: Description | None = None
    price: Price
    calories: SmallNonNegative | None = None
    allergens: Allergens | None = None
    dietary_flags: DietaryFlags | None = None
    image_filename: ImageFilename | None = None
    is_available: bool = True
    is_featured: bool = False


class MenuItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    item_id: str
    cat_id: str
    name_en: str
    name_fil: str
    name_bis: str
    description_en: str | None
    description_fil: str | None
    description_bis: str | None
    price: Decimal
    calories: int | None
    allergens: str | None
    dietary_flags: str | None
    image_filename: str | None
    is_available: bool
    is_featured: bool
