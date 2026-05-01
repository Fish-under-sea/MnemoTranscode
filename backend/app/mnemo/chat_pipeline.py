# 对话主链路：情节写入 → 意识召回 → LLM → 记忆编码（同请求内完成，避免复用已关闭的 DB 会话）

from __future__ import annotations

import logging

from app.mnemo.activation_engine import ActivationEngine
from app.mnemo.conscious_recall import ConsciousRecall, SelfCore
from app.mnemo.graph_sql import SqlAlchemyGraphManager
from app.mnemo.sleep_consolidator import SleepConsolidator
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)


class ChatPipeline:
    """
    对话 pipeline：
    1. episodic_encoding — 用户话语文本 → Event 节点
    2. conscious_recall — 激活 + SelfCore
    3. prompt 组装 — system 扩展段
    4. llm_generate
    5. semantic_abstraction — 实体写入（本轮对话末尾执行）
    6. post_memory_update — 助手回复写 Event + 边
    """

    def __init__(
        self,
        graph: SqlAlchemyGraphManager,
        activation: ActivationEngine,
        recall: ConsciousRecall,
        llm: LLMService,
        self_core: SelfCore,
        *,
        base_system_prompt: str,
        member_id: int,
        consolidator: SleepConsolidator | None = None,
    ) -> None:
        self.graph = graph
        self.activation = activation
        self.recall = recall
        self.llm = llm
        self.self_core = self_core
        self.base_system_prompt = base_system_prompt
        self.member_id = member_id
        self.consolidator = consolidator

    async def chat(self, user_message: str, history: list[dict]) -> str:
        episode_id = await self.graph.create_node(
            "Event",
            user_message,
            member_id=self.member_id,
            importance=0.6,
            activation_energy=0.75,
        )

        ctx = await self.recall.recall(
            query=user_message,
            self_core=self.self_core,
            recent_turns=list(history),
        )
        conscious_ext = await self.recall.assemble_system_extension(ctx)
        system_prompt = f"{self.base_system_prompt}\n\n{conscious_ext}"

        reply = await self.llm.get_response(
            message=user_message,
            system_prompt=system_prompt,
            history=history,
        )

        try:
            await self._encode_semantics(episode_id, user_message)
            await self._encode_response(reply, episode_id)
        except Exception as exc:
            logger.exception("对话后记忆编码失败（不影响本轮回复）: %s", exc)
        return reply

    async def _encode_semantics(self, episode_id: str, message: str) -> None:
        prompt = f"""从下列用户话语文本中提取最多 4 个简短「实体或命题」（中文名词短语），JSON：
{{"entities": [{{"text": "...", "stub": "提及|态度|计划|回忆"}}]}}
文本：{message[:1500]}"""
        try:
            data = await self.llm.json_complete(prompt)
        except Exception as exc:
            logger.debug("语义抽象跳过: %s", exc)
            return
        entities = data.get("entities") if isinstance(data, dict) else None
        if not isinstance(entities, list):
            return
        for ent in entities[:4]:
            if not isinstance(ent, dict):
                continue
            text = str(ent.get("text", "")).strip()
            if len(text) < 2:
                continue
            nid = await self.graph.create_node(
                "SemanticFact",
                text,
                member_id=self.member_id,
                importance=0.45,
            )
            await self.graph.create_edge(episode_id, nid, "SUPPORTS", weight=0.45)

    async def _encode_response(self, response: str, trigger_episode_id: str) -> None:
        rid = await self.graph.create_node(
            "Event",
            f"【助手】{response[:3500]}",
            member_id=self.member_id,
            importance=0.5,
        )
        await self.graph.create_edge(trigger_episode_id, rid, "CAUSED_BY", weight=0.6)
