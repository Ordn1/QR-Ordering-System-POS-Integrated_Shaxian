from app.models import Transaction
from app.websocket.manager import manager


def order_status_event(transaction: Transaction) -> dict:
    return {
        "type": "order_status",
        "txn_id": transaction.txn_id,
        "queue_number": transaction.queue_number,
        "status": transaction.status.value,
    }


def queue_changed_event() -> dict:
    return {"type": "queue_changed"}


def session_changed_event(session_id: int) -> dict:
    return {
        "type": "session_changed",
        "session_id": session_id,
    }


def cart_changed_event(session_id: int) -> dict:
    return {
        "type": "cart_changed",
        "session_id": session_id,
    }


async def publish_status(transaction: Transaction) -> None:
    await manager.to_table(transaction.session_id, order_status_event(transaction))
    await manager.to_kitchen(queue_changed_event())


async def publish_new_order(transaction: Transaction) -> None:
    await manager.to_kitchen(queue_changed_event())
    await manager.to_table(transaction.session_id, order_status_event(transaction))


async def publish_session_changed(session_id: int) -> None:
    await manager.to_table(session_id, session_changed_event(session_id))


async def publish_cart_changed(session_id: int) -> None:
    await manager.to_table(session_id, cart_changed_event(session_id))