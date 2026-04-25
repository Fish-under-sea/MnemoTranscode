"""
向量检索服务

负责记忆的向量化存储和语义检索
"""

import uuid
from typing import Annotated, Literal

import httpx
import numpy as np

from app.core.config import get_settings

settings = get_settings()


class VectorService:
    """向量检索服务"""

    def __init__(self):
        self.qdrant_url = settings.qdrant_url
        self.collection_name = settings.qdrant_collection
        self.embedding_model = settings.embedding_model
        self.embedding_dim = settings.embedding_dim
        self._api_key = getattr(settings, 'qdrant_api_key', None)

    async def generate_embedding(self, text: str) -> list[float]:
        """调用嵌入模型生成向量"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.llm_base_url.rstrip('/')}/embeddings",
                headers={"Authorization": f"Bearer {settings.llm_api_key}"},
                json={
                    "model": self.embedding_model,
                    "input": text,
                },
            )
            data = response.json()
            return data["data"][0]["embedding"]

    async def search_memories(
        self,
        query: str,
        user_id: int,
        archive_id: int | None = None,
        member_id: int | None = None,
        limit: int = 10,
    ) -> list[dict]:
        """语义搜索记忆"""
        query_vector = await self.generate_embedding(query)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.qdrant_url}/collections/{self.collection_name}/points/search",
                headers=self._get_headers(),
                json={
                    "vector": query_vector,
                    "limit": limit,
                    "score_threshold": 0.7,
                    "filter": {
                        "must": [
                            {"key": "user_id", "match": {"value": user_id}},
                        ]
                    },
                },
            )

            if response.status_code != 200:
                return []

            results = response.json().get("result", [])
            return results

    async def upsert_memory(
        self,
        memory_id: int,
        user_id: int,
        content: str,
        metadata: dict | None = None,
    ) -> str:
        """存储记忆向量"""
        vector_id = str(uuid.uuid4())
        vector = await self.generate_embedding(content)

        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.put(
                f"{self.qdrant_url}/collections/{self.collection_name}/points",
                headers=self._get_headers(),
                json={
                    "points": [
                        {
                            "id": vector_id,
                            "vector": vector,
                            "payload": {
                                "memory_id": memory_id,
                                "user_id": user_id,
                                "content": content,
                                **(metadata or {}),
                            },
                        }
                    ]
                },
            )

        return vector_id

    async def delete_memory(self, vector_id: str) -> bool:
        """删除记忆向量"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.qdrant_url}/collections/{self.collection_name}/points/delete",
                headers=self._get_headers(),
                json={"points": [vector_id]},
            )
            return response.status_code == 200

    def _get_headers(self) -> dict:
        """获取请求头"""
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["api-key"] = self._api_key
        return headers
