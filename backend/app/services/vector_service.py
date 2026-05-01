"""
向量检索服务

负责记忆的向量化存储和语义检索
"""

import uuid

import httpx

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

    async def generate_embedding(
        self,
        text: str,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> list[float]:
        """调用嵌入模型生成向量（可选用调用方传入的网关，便于与 client_llm 一致）。"""
        key = (api_key if api_key is not None else settings.llm_api_key) or ""
        root = (base_url if base_url is not None else settings.llm_base_url).rstrip("/")
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if key.strip():
            headers["Authorization"] = f"Bearer {key}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{root}/embeddings",
                headers=headers,
                json={
                    "model": self.embedding_model,
                    "input": text,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]

    async def search_engram_seeds(
        self,
        query: str,
        user_id: int,
        member_id: int,
        limit: int = 3,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> list[str]:
        """按用户+成员检索 engram_id（payload 须含 engram_id；否则退回空由 SQL 种子）。"""
        query_vector = await self.generate_embedding(query, api_key=api_key, base_url=base_url)
        must = [
            {"key": "user_id", "match": {"value": user_id}},
            {"key": "member_id", "match": {"value": member_id}},
        ]
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.qdrant_url}/collections/{self.collection_name}/points/search",
                headers=self._get_headers(),
                json={
                    "vector": query_vector,
                    "limit": limit * 2,
                    "score_threshold": 0.55,
                    "filter": {"must": must},
                },
            )
            if response.status_code != 200:
                return []
            results = response.json().get("result", [])
            out: list[str] = []
            for r in results:
                pl = r.get("payload") or {}
                eid = pl.get("engram_id")
                if eid:
                    out.append(str(eid))
                if len(out) >= limit:
                    break
        if out:
            return out[:limit]
        # 无 member 过滤命中时放宽到仅 user（老数据无 member_id 时）
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.qdrant_url}/collections/{self.collection_name}/points/search",
                headers=self._get_headers(),
                json={
                    "vector": query_vector,
                    "limit": limit * 2,
                    "score_threshold": 0.55,
                    "filter": {"must": [{"key": "user_id", "match": {"value": user_id}}]},
                },
            )
            if response.status_code != 200:
                return []
            results = response.json().get("result", [])
            out = []
            for r in results:
                pl = r.get("payload") or {}
                eid = pl.get("engram_id")
                if eid:
                    out.append(str(eid))
                if len(out) >= limit:
                    break
            return out[:limit]

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
        *,
        engram_id: str | None = None,
        member_id: int | None = None,
        point_id: str | None = None,
    ) -> str:
        """存储记忆向量（可选用 point_id 幂等覆盖，如与 engram UUID 对齐）。"""
        vector_id = point_id or str(uuid.uuid4())
        vector = await self.generate_embedding(content)

        payload = {
            "memory_id": memory_id,
            "user_id": user_id,
            "content": content,
            **(metadata or {}),
        }
        if engram_id:
            payload["engram_id"] = engram_id
        if member_id is not None:
            payload["member_id"] = member_id

        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.put(
                f"{self.qdrant_url}/collections/{self.collection_name}/points",
                headers=self._get_headers(),
                json={
                    "points": [
                        {
                            "id": vector_id,
                            "vector": vector,
                            "payload": payload,
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
