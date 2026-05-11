"""将 LLM 网关 URL 中的环回地址替换为 Docker/服务端可到达的主机名（如 host.docker.internal）。"""

from __future__ import annotations

from urllib.parse import urlparse, urlunparse

# 浏览器侧常见「本机 Ollama」写法；在容器内访问会指向容器自身，须改写
_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})


def rewrite_llm_url_if_loopback(url: str, substitute: str) -> str:
    """
    若 url 的主机为环回地址且 substitute 非空，则将主机名替换为 substitute（端口与用户认证保留）。
    substitute 仅填主机名，勿带 scheme；若 Ollama 使用非默认端口，保留在 url 中即可。
    """
    sub = (substitute or "").strip()
    raw = (url or "").strip()
    if not sub or not raw:
        return raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host not in _LOOPBACK_HOSTS:
        return raw
    port = parsed.port
    if port is not None:
        new_netloc = f"{sub}:{port}"
    else:
        new_netloc = sub
    if parsed.username is not None:
        if parsed.password is not None:
            new_netloc = f"{parsed.username}:{parsed.password}@{new_netloc}"
        else:
            new_netloc = f"{parsed.username}@{new_netloc}"
    return urlunparse(
        (parsed.scheme, new_netloc, parsed.path, parsed.params, parsed.query, parsed.fragment),
    )
