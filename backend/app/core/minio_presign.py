"""MinIO 预签名 URL 使用的 endpoint。

浏览器直传（PUT）必须与用户地址栏可达的主机一致：Docker 内 `minio:9000` 在宿主机浏览器无法解析，
须通过 MINIO_PUBLIC_ENDPOINT（如 localhost:9000）生成预签名链接；参见 infra/docker-compose.yml。
"""

from app.core.config import get_settings


def minio_presign_endpoint() -> str:
    s = get_settings()
    pub = (s.minio_public_endpoint or "").strip()
    if pub:
        return pub
    ep = (s.minio_endpoint or "").strip()
    if ep.startswith("minio:"):
        return "127.0.0.1" + ep[5:]
    return ep
