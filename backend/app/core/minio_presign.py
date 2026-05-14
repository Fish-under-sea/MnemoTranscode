"""MinIO 预签名 URL 使用的 endpoint。

浏览器打开的链接主机须为用户可达地址（MINIO_PUBLIC_ENDPOINT）；
但 MinIO Python SDK 在**服务端**生成预签名时会向该 endpoint 发 HTTP（如 _get_region），
必须能 TCP 连上真实 MinIO。

常见问题：
- Compose 默认 `MINIO_PUBLIC_ENDPOINT=localhost:9000`：在**容器内** localhost 指向容器自身，
  并非宿主机上的 MinIO → 连接拒绝 + urllib3 长时间重试。
- `presigned_*` 为同步阻塞调用：局域网多人同时拉缩略图/下载链时，单 worker Uvicorn 事件循环被占满，
  其它请求与健康检查超时，看起来像「整机崩溃」。

对策：
- 「逻辑上的浏览器主机」仍由 `minio_presign_endpoint()`（MINIO_PUBLIC_ENDPOINT）表达；
- 若公网侧为 localhost/127.0.0.1，且（服务端走 Docker 网络 `minio:` **或** 当前在容器内），则 SDK 实际使用
  `host.docker.internal:端口`（与 `infra/docker-compose.yml` 中 `backend.extra_hosts` 一致），
  使容器内建连落在宿主机 published 的 MinIO 上。仅依赖 `minio:` 不够：`backend/.env` 常误带 `MINIO_ENDPOINT=localhost`，
  会绕过 `minio:` 分支导致仍连容器自身。
- 局域网联调请将仓库根或 compose 旁 `.env` 的 `MTC_PUBLIC_HOST` 设为宿主局域网 IP，使同事浏览器与
  容器内 SDK 使用同一 `host:port` 访问 MinIO，无需 host-gateway 映射。
"""

from __future__ import annotations

import os

from app.core.config import get_settings

_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "[::1]"})


def _running_inside_docker() -> bool:
    """进程跑在 Docker 容器内时存在此文件（LinuxKit / moby 约定）。"""
    return os.path.exists("/.dockerenv")


def _infer_default_port() -> int:
    s = get_settings()
    ep = (s.minio_endpoint or "").strip()
    if ":" in ep:
        tail = ep.rsplit(":", 1)[-1]
        if tail.isdigit():
            return int(tail)
    return 9000


def _split_host_port(endpoint: str) -> tuple[str, int]:
    """解析 host:port；无端口时用服务对象存储默认端口。"""
    ep = endpoint.strip()
    if not ep:
        return "127.0.0.1", _infer_default_port()
    if ep.startswith("["):
        if "]:" in ep:
            inner, _, port_s = ep.partition("]:")
            host = inner.lstrip("[").strip()
            return host, int(port_s) if port_s.isdigit() else _infer_default_port()
        return ep.strip("[]"), _infer_default_port()
    if ep.count(":") > 1 and not ep.startswith("http"):
        # IPv6 无端口：::1
        return ep, _infer_default_port()
    if ":" in ep:
        host, _, port_s = ep.rpartition(":")
        if port_s.isdigit():
            return host, int(port_s)
    return ep, _infer_default_port()


def minio_presign_endpoint() -> str:
    """浏览器侧应使用的主机:端口（与 MINIO_PUBLIC_ENDPOINT 一致；空则按 minio_endpoint 推导）。"""
    s = get_settings()
    pub = (s.minio_public_endpoint or "").strip()
    if pub:
        return pub
    ep = (s.minio_endpoint or "").strip()
    if ep.startswith("minio:"):
        return "127.0.0.1" + ep[5:]
    return ep


def minio_internal_connect_endpoint() -> str:
    """服务端 MinIO SDK 建连地址（get/put/stat）。容器内纠正误配的 localhost，避免指向容器自身。"""
    s = get_settings()
    ep = (s.minio_endpoint or "").strip()
    if not ep:
        ep = f"localhost:{_infer_default_port()}"
    host, port = _split_host_port(ep)
    if host in _LOCAL_HOSTS and _running_inside_docker():
        return f"host.docker.internal:{port}"
    return ep


def minio_sdk_endpoint_for_presign() -> str:
    """MinIO SDK 在服务端生成预签名时连接的 endpoint（host:port），须从当前进程可达。"""
    s = get_settings()
    logical = minio_presign_endpoint()
    internal = (s.minio_endpoint or "").strip()
    host, port = _split_host_port(logical)
    if host in _LOCAL_HOSTS and (internal.startswith("minio:") or _running_inside_docker()):
        return f"host.docker.internal:{port}"
    return logical
