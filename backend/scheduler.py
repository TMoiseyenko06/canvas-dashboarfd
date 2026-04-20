from apscheduler.schedulers.background import BackgroundScheduler
import logging

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler()


def start_scheduler(sync_fn):
    _scheduler.add_job(sync_fn, "interval", minutes=30, id="canvas_sync", replace_existing=True)
    _scheduler.start()
    logger.info("Background scheduler started — Canvas sync every 30 minutes")


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
