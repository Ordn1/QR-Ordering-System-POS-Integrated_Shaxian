from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    AuthenticationError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    PermissionError,
)
from app.core.security import hash_password, verify_password
from app.models import (
    AuditLog,
    KitchenQueue,
    PriorityVerificationLog,
    StaffAccount,
    Transaction,
)
from app.models.enums import StaffRole
from app.schemas.auth import StaffCreate, StaffUpdate

CREDENTIALS_REJECTED = "That username and password do not match."


# Read
async def authenticate(db: AsyncSession, username: str, password: str) -> StaffAccount:
    """Verify credentials and stamp the login, or raise AuthenticationError."""
    staff = await db.scalar(
        select(StaffAccount).where(func.lower(StaffAccount.username) == username.lower())
    )

    if staff is None or not verify_password(password, staff.password_hash):
        db.add(
            AuditLog(
                staff_id=staff.staff_id if staff else None,
                action="login_failed",
                entity_type="staff_account",
                entity_id=staff.staff_id if staff else None,
                after_state={"username": username[:2] + "••••••" if len(username) >= 2 else "••••"},
            )
        )
        await db.commit()
        raise AuthenticationError(CREDENTIALS_REJECTED)

    if not staff.is_active:
        raise AuthenticationError("That account has been deactivated.")

    staff.last_login_at = datetime.now(UTC)
    db.add(
        AuditLog(
            staff_id=staff.staff_id,
            action="login_success",
            entity_type="staff_account",
            entity_id=staff.staff_id,
            after_state={"role": staff.role.value},
        )
    )
    await db.commit()

    return staff


# Validate
def require_role(staff: StaffAccount, *allowed: StaffRole) -> StaffAccount:
    """Enforce a role at the service layer, where hiding a button is not security."""
    if staff.role not in allowed:
        raise PermissionError("Your account does not have access to that.")
    return staff


def require_admin(staff: StaffAccount) -> StaffAccount:
    return require_role(staff, StaffRole.ADMIN)


def require_staff(staff: StaffAccount) -> StaffAccount:
    return require_role(staff, StaffRole.ADMIN, StaffRole.SERVICE_CREW)


# Read
async def list_staff(db: AsyncSession, *, active_only: bool = False) -> list[StaffAccount]:
    statement = select(StaffAccount).order_by(StaffAccount.staff_id.asc())
    if active_only:
        statement = statement.where(StaffAccount.is_active.is_(True))
    return list(await db.scalars(statement))


async def get_staff(db: AsyncSession, staff_id: str) -> StaffAccount:
    staff = await db.get(StaffAccount, staff_id)
    if staff is None:
        raise NotFoundError("That staff account no longer exists. Refresh the list.")
    return staff


# Validate
async def guard_username(
    db: AsyncSession, username: str, *, exclude: str | None = None
) -> None:
    statement = select(StaffAccount.staff_id).where(
        func.lower(StaffAccount.username) == username.lower()
    )
    if exclude:
        statement = statement.where(StaffAccount.staff_id != exclude)
    if await db.scalar(statement):
        raise ConflictError(f"A staff account with username '{username}' already exists.")


async def _ensure_active_admin_remains(
    db: AsyncSession, target_staff_id: str
) -> None:
    remaining_admins = await db.scalar(
        select(func.count())
        .select_from(StaffAccount)
        .where(
            StaffAccount.role == StaffRole.ADMIN,
            StaffAccount.is_active.is_(True),
            StaffAccount.staff_id != target_staff_id,
        )
    )
    if not remaining_admins:
        raise BusinessRuleError(
            "At least one active administrator account must remain in the system."
        )


# Create
async def create_staff(
    db: AsyncSession, payload: StaffCreate, actor_id: str | None = None
) -> StaffAccount:
    """Create a staff or administrator account with a bcrypt-hashed password."""
    await guard_username(db, payload.username)

    staff = StaffAccount(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=payload.role,
        is_active=payload.is_active,
    )
    db.add(staff)
    await db.flush()

    db.add(
        AuditLog(
            staff_id=actor_id,
            action="staff_create",
            entity_type="staff_account",
            entity_id=staff.staff_id,
            after_state={
                "username": staff.username,
                "full_name": staff.full_name,
                "role": staff.role.value,
                "is_active": staff.is_active,
            },
        )
    )

    # Commit
    await db.commit()
    await db.refresh(staff)
    return staff


# Update
async def update_staff(
    db: AsyncSession,
    staff_id: str,
    payload: StaffUpdate,
    actor_id: str | None = None,
) -> StaffAccount:
    """Update a staff account's profile, role, active state, or password."""
    staff = await get_staff(db, staff_id)
    await guard_username(db, payload.username, exclude=staff_id)

    if staff_id == actor_id and not payload.is_active:
        raise BusinessRuleError("You cannot deactivate your own currently signed-in account.")

    if staff_id == actor_id and payload.role != StaffRole.ADMIN:
        raise BusinessRuleError("You cannot remove administrator access from your own account.")

    if staff.role == StaffRole.ADMIN and (
        payload.role != StaffRole.ADMIN or not payload.is_active
    ):
        await _ensure_active_admin_remains(db, staff_id)

    before = {
        "username": staff.username,
        "full_name": staff.full_name,
        "role": staff.role.value,
        "is_active": staff.is_active,
    }

    staff.username = payload.username.strip()
    staff.full_name = payload.full_name.strip()
    staff.role = payload.role
    staff.is_active = payload.is_active

    password_changed = False
    if payload.password:
        staff.password_hash = hash_password(payload.password)
        password_changed = True

    after: dict[str, object] = {
        "username": staff.username,
        "full_name": staff.full_name,
        "role": staff.role.value,
        "is_active": staff.is_active,
    }
    if password_changed:
        after["password_changed"] = True

    db.add(
        AuditLog(
            staff_id=actor_id,
            action="staff_update",
            entity_type="staff_account",
            entity_id=staff.staff_id,
            before_state=before,
            after_state=after,
        )
    )

    # Commit
    await db.commit()
    await db.refresh(staff)
    return staff


# Update
async def toggle_staff_status(
    db: AsyncSession,
    staff_id: str,
    is_active: bool,
    actor_id: str | None = None,
) -> StaffAccount:
    """Activate or deactivate a staff account while preserving audit history."""
    staff = await get_staff(db, staff_id)

    if staff_id == actor_id and not is_active:
        raise BusinessRuleError("You cannot deactivate your own currently signed-in account.")

    if staff.role == StaffRole.ADMIN and not is_active:
        await _ensure_active_admin_remains(db, staff_id)

    old_active = staff.is_active
    staff.is_active = is_active

    if old_active != is_active:
        db.add(
            AuditLog(
                staff_id=actor_id,
                action="staff_status_change",
                entity_type="staff_account",
                entity_id=staff.staff_id,
                before_state={"is_active": old_active},
                after_state={"is_active": is_active},
            )
        )

    # Commit
    await db.commit()
    await db.refresh(staff)
    return staff


# Delete
async def delete_staff(
    db: AsyncSession, staff_id: str, actor_id: str | None = None
) -> None:
    """Delete an unreferenced staff account, or require deactivation if referenced by history."""
    staff = await get_staff(db, staff_id)

    if staff_id == actor_id:
        raise BusinessRuleError("You cannot delete your own currently signed-in account.")

    if staff.role == StaffRole.ADMIN and staff.is_active:
        await _ensure_active_admin_remains(db, staff_id)

    queue_refs = await db.scalar(
        select(func.count())
        .select_from(KitchenQueue)
        .where(KitchenQueue.updated_by == staff_id)
    )
    verif_refs = await db.scalar(
        select(func.count())
        .select_from(PriorityVerificationLog)
        .where(PriorityVerificationLog.verified_by == staff_id)
    )
    void_refs = await db.scalar(
        select(func.count())
        .select_from(Transaction)
        .where(Transaction.voided_by == staff_id)
    )
    audit_refs = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.staff_id == staff_id)
    )

    if (queue_refs or 0) + (verif_refs or 0) + (void_refs or 0) + (audit_refs or 0) > 0:
        raise BusinessRuleError(
            f"{staff.full_name} is referenced in historical records and cannot be deleted. "
            "Deactivate the account instead."
        )

    db.add(
        AuditLog(
            staff_id=actor_id,
            action="staff_delete",
            entity_type="staff_account",
            entity_id=staff.staff_id,
            before_state={
                "username": staff.username,
                "full_name": staff.full_name,
                "role": staff.role.value,
            },
        )
    )
    await db.delete(staff)
    await db.commit()