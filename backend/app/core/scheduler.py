"""
APScheduler 기반 백그라운드 작업
- 매일 오전 9시: 재고 부족 + 유통기한 임박 체크 → 알림 발송
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import date, timedelta
from sqlalchemy.orm import Session

from .database import SessionLocal
from ..models import Inventory, Item, PushToken

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


async def send_push(title: str, body: str, tokens: list[str]):
    """Expo Push Notification 발송"""
    if not tokens:
        return
    import httpx
    messages = [
        {"to": token, "title": title, "body": body, "sound": "default"}
        for token in tokens
    ]
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            resp.raise_for_status()
        except Exception as e:
            logger.error(f"Push 알림 실패: {e}")


async def check_inventory_alerts():
    """재고 부족 + 유통기한 임박 체크 후 푸시 알림"""
    db: Session = SessionLocal()
    try:
        today = date.today()
        soon = today + timedelta(days=3)
        inventories = db.query(Inventory).join(Item).all()

        low_stock_items = []
        expiring_items = []

        for inv in inventories:
            item = inv.item
            if inv.quantity <= item.min_stock and item.min_stock > 0:
                low_stock_items.append(f"• {item.name} ({inv.quantity}{item.unit} 남음)")
            if inv.expiry_date and inv.expiry_date <= soon:
                days_left = (inv.expiry_date - today).days
                expiring_items.append(f"• {item.name} (D-{days_left})")

        # DB에서 토큰 조회
        push_tokens = [row.token for row in db.query(PushToken.token).all()]

        if low_stock_items and push_tokens:
            await send_push(
                title="⚠️ 재고 부족 알림",
                body="\n".join(low_stock_items[:5]),
                tokens=push_tokens,
            )

        if expiring_items and push_tokens:
            await send_push(
                title="🕐 유통기한 임박 알림",
                body="\n".join(expiring_items[:5]),
                tokens=push_tokens,
            )

        logger.info(f"[Scheduler] 알림 체크 완료 - 부족:{len(low_stock_items)} 임박:{len(expiring_items)}")
    finally:
        db.close()


def start_scheduler():
    # 매일 오전 9시 실행
    scheduler.add_job(
        check_inventory_alerts,
        trigger=CronTrigger(hour=9, minute=0),
        id="daily_alert",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] 시작됨 - 매일 09:00 알림 체크")
