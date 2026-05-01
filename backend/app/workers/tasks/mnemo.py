"""MnemoTranscode 睡眠固化任务（Celery 定时或手工触发）。"""

from __future__ import annotations

import asyncio
import logging

from app.core.database import async_session_factory
from app.mnemo.graph_sql import SqlAlchemyGraphManager
from app.mnemo.sleep_consolidator import SleepConsolidator
from app.services.llm_service import LLMService
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="mnemo.run_consolidation")
def run_mnemo_consolidation(user_id: int) -> dict:
    """对指定用户执行一轮睡眠固化（需在任务参数中传 user_id）。"""

    async def _run() -> dict:
        async with async_session_factory() as session:
            graph = SqlAlchemyGraphManager(session, user_id)
            llm = LLMService()
            cons = SleepConsolidator(graph, llm)
            stats = await cons.run_consolidation(window_hours=1.0)
            await session.commit()
            return stats

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.exception("mnemo.run_consolidation 失败: %s", exc)
        raise
