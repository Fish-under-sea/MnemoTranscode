"""
MnemoTranscode V2 核心（PostgreSQL 图记忆 + 扩散激活 + 意识召回）

对齐 Core Source Pack 的算法语义；默认不依赖 Neo4j，保证现有部署可启动。
"""

from app.mnemo.activation_engine import ActivationEngine, ActivationCluster, ActivationResult
from app.mnemo.chat_pipeline import ChatPipeline

__all__ = [
    "ActivationEngine",
    "ActivationCluster",
    "ActivationResult",
    "ChatPipeline",
]
