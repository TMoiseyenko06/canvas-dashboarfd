from apscheduler.schedulers.background import BackgroundScheduler
import logging

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler()


def start_scheduler(sync_fn, notify_fn):
    _scheduler.add_job(sync_fn, "interval", minutes=30, id="canvas_sync", replace_existing=True)
    _scheduler.add_job(notify_fn, "interval", minutes=15, id="telegram_notify", replace_existing=True)
    _scheduler.start()
    logger.info("Scheduler started — Canvas sync every 30 min, Telegram check every 15 min")


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
