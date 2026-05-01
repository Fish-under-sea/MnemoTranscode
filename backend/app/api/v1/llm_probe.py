"""
LLM 端点探测：连通性与可用模型列表（经服务端代发，避免浏览器 CORS 与密钥直传第三方时的问题）

- OpenAI 兼容：GET {base}/v1/models，Bearer
- Ollama：GET {base}/api/tags
- Google Gemini 官方：GET {base}/models（base 为 …/v1beta），`x-goog-api-key`
- Anthropic 官方：GET {base}/v1/models，`x-api-key` + `anthropic-version`
- 智谱 OpenAI 兼容：GET {base}/models，Bearer
"""

import ipaddress
import re
import time
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.v1.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/llm-probe", tags=["LLM 探测"])

# 仅允许 http(s)；禁止 file、ftp、gopher 等
_SCHEMES = ("http", "https")

# 内网/本机与常见开发主机名放行（Ollama 多在本机或 Docker host）
_EXEMPT_HOSTNAMES = frozenset(
    {
        "localhost",
        "127.0.0.1",
        "::1",
        "host.docker.internal",
    }
)
_METADATA_RE = re.compile(
    r"^169\.254\.|metadata\.(google|gce)|metadata\.(internal|ec2)\b",
    re.IGNORECASE,
)


def _host_allowed(hostname: str) -> bool:
    h = (hostname or "").strip().lower()
    if h in _EXEMPT_HOSTNAMES:
        return True
    if _METADATA_RE.search(h):
        return False
    try:
        ip = ipaddress.ip_address(h)
        if ip.is_loopback or ip.is_private or ip.is_link_local:
            return True
        if ip in ipaddress.ip_network("169.254.0.0/16"):
            return False
    except ValueError:
        # 非 IP 的域名：放行（用户自有 API 域名与代理）
        pass
    return True


def _assert_safe_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        raise HTTPException(status_code=400, detail="base_url 不能为空")
    if len(u) > 2000:
        raise HTTPException(status_code=400, detail="base_url 过长")
    parsed = urlparse(u)
    if parsed.scheme not in _SCHEMES:
        raise HTTPException(status_code=400, detail="仅支持 http / https 的 base_url")
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="base_url 格式无效")
    host = parsed.hostname or ""
    if not _host_allowed(host):
        raise HTTPException(status_code=400, detail="该目标地址不被允许")
    return u.rstrip("/")


def _openai_compat_models_url(base: str) -> str:
    """
    OpenAI 兼容「模型列表」地址：若用户已填 …/v1 根，则应为 {base}/models，避免 …/v1/v1/models。
    """
    b = base.rstrip("/")
    if b.lower().endswith("/v1"):
        return f"{b}/models"
    return f"{b}/v1/models"


def _format_upstream_error(status: int, text: str, max_len: int = 280) -> str:
    """将网关返回的 HTML（如 openresty/nginx 404 页）收成可读说明，避免整块 HTML 进 toast。"""
    snippet = (text or "").strip()
    low = snippet[:500].lower()
    if "<html" in low or low.startswith("<!doctype"):
        return (
            f"HTTP {status}：上游返回网页而非 API JSON（多为 Base URL 路径错误、或网关 404）。"
            "请按服务商文档填写 OpenAI 兼容根地址：若文档要求填到 /v1，则 Base 应以 /v1 结尾，且勿再重复 /v1。"
        )
    return f"HTTP {status}：{snippet[:max_len]}"


class LlmCheckRequest(BaseModel):
    mode: Literal["openai", "ollama", "google", "anthropic", "zhipu"] = "openai"
    base_url: str = Field(..., min_length=1)
    """openai: …/v1；ollama: 根；google: …/v1beta；anthropic: https://api.anthropic.com；zhipu: …/v4"""

    api_key: str | None = None
    """Google：Gemini API Key；Anthropic：x-api-key；其余多为 Bearer。Ollama 可空。"""


class LlmCheckResponse(BaseModel):
    ok: bool
    latency_ms: int | None = None
    error: str | None = None
    models: list[str] = []


async def _fetch_openai_models(base: str, api_key: str | None) -> tuple[bool, str | None, list[str], int | None]:
    url = _openai_compat_models_url(base)
    headers: dict[str, str] = {}
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
    except httpx.RequestError as e:
        return False, f"网络错误：{e}", [], None
    ms = int((time.perf_counter() - t0) * 1000)
    if r.status_code >= 400:
        detail = _format_upstream_error(r.status_code, r.text)
        netloc = (urlparse(url).hostname or "").lower()
        if r.status_code == 401 and "xiaomimimo.com" in netloc:
            detail += (
                " ｜ MiMo：token-plan-* 网关仅接受在小米平台「Token Plan（代币计划）」页签创建的密钥（通常以 tp- 开头）；"
                "与 api.xiaomimimo.com 的按量付费密钥不通用。请在 platform.xiaomimimo.com 进入 Token Plan 重新创建或复制密钥。"
            )
        return False, detail, [], ms
    try:
        data: dict[str, Any] = r.json()
    except Exception:
        return False, "响应不是合法 JSON", [], ms
    items = data.get("data")
    if not isinstance(items, list):
        return True, None, [], ms
    ids: list[str] = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("id"), str):
            ids.append(it["id"])
    ids = sorted(set(ids))
    return True, None, ids, ms


async def _fetch_ollama_tags(base: str) -> tuple[bool, str | None, list[str], int | None]:
    url = f"{base}/api/tags"
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(url)
    except httpx.RequestError as e:
        return False, f"网络错误：{e}", [], None
    ms = int((time.perf_counter() - t0) * 1000)
    if r.status_code >= 400:
        return False, _format_upstream_error(r.status_code, r.text), [], ms
    try:
        data: dict[str, Any] = r.json()
    except Exception:
        return False, "响应不是合法 JSON", [], ms
    models = data.get("models")
    out: list[str] = []
    if isinstance(models, list):
        for m in models:
            if isinstance(m, dict) and isinstance(m.get("name"), str):
                out.append(m["name"])
    out = sorted(set(out))
    return True, None, out, ms


async def _fetch_google_models(base: str, api_key: str | None) -> tuple[bool, str | None, list[str], int | None]:
    key = (api_key or "").strip()
    if not key:
        return False, "Google Gemini 拉取模型列表需提供 API Key（x-goog-api-key）", [], None
    url = f"{base.rstrip('/')}/models"
    params: dict[str, str | int] = {"pageSize": 200}
    headers = {"x-goog-api-key": key}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers, params=params)
    except httpx.RequestError as e:
        return False, f"网络错误：{e}", [], None
    ms = int((time.perf_counter() - t0) * 1000)
    if r.status_code >= 400:
        return False, _format_upstream_error(r.status_code, r.text), [], ms
    try:
        data: dict[str, Any] = r.json()
    except Exception:
        return False, "响应不是合法 JSON", [], ms
    items = data.get("models")
    if not isinstance(items, list):
        return True, None, [], ms
    out: list[str] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = it.get("name")
        if isinstance(name, str) and name:
            if name.startswith("models/"):
                out.append(name.replace("models/", "", 1))
            else:
                out.append(name)
    out = sorted(set(out))
    return True, None, out, ms


async def _fetch_anthropic_models(base: str, api_key: str | None) -> tuple[bool, str | None, list[str], int | None]:
    key = (api_key or "").strip()
    if not key:
        return False, "Anthropic 拉取模型列表需提供 x-api-key", [], None
    url = f"{base.rstrip('/')}/v1/models"
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
    }
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers, params={"limit": 200})
    except httpx.RequestError as e:
        return False, f"网络错误：{e}", [], None
    ms = int((time.perf_counter() - t0) * 1000)
    if r.status_code >= 400:
        return False, _format_upstream_error(r.status_code, r.text), [], ms
    try:
        data: dict[str, Any] = r.json()
    except Exception:
        return False, "响应不是合法 JSON", [], ms
    items = data.get("data")
    if not isinstance(items, list):
        return True, None, [], ms
    ids: list[str] = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("id"), str):
            ids.append(it["id"])
    ids = sorted(set(ids))
    return True, None, ids, ms


async def _fetch_zhipu_openai_style_models(base: str, api_key: str | None) -> tuple[bool, str | None, list[str], int | None]:
    """智谱开放文档：GET {base}/models，与 OpenAI 风格列表。"""
    key = (api_key or "").strip()
    if not key:
        return False, "智谱拉取模型列表需提供 API Key", [], None
    url = f"{base.rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {key}"}
    t0 = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
    except httpx.RequestError as e:
        return False, f"网络错误：{e}", [], None
    ms = int((time.perf_counter() - t0) * 1000)
    if r.status_code >= 400:
        return False, _format_upstream_error(r.status_code, r.text), [], ms
    try:
        data: dict[str, Any] = r.json()
    except Exception:
        return False, "响应不是合法 JSON", [], ms
    items = data.get("data")
    if not isinstance(items, list):
        return True, None, [], ms
    ids: list[str] = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("id"), str):
            ids.append(it["id"])
    ids = sorted(set(ids))
    return True, None, ids, ms


@router.post("/check", response_model=LlmCheckResponse)
async def check_llm_endpoint(
    body: LlmCheckRequest,
    _user: User = Depends(get_current_user),
):
    """
    一次请求完成：端点是否可达、延迟、模型 ID 列表。

    - **openai**：`base_url` 含 `/v1` 时请求 `{base}/v1/models`（Bearer）
    - **ollama**：`{base}/api/tags`
    - **google**：`{base}/models`（`x-goog-api-key`）
    - **anthropic**：`{base}/v1/models`（`x-api-key` + `anthropic-version`）
    - **zhipu**：`{base}/models`（Bearer），base 为 `.../v4` 根
    """
    base = _assert_safe_url(body.base_url)
    key = (body.api_key or "").strip() or None

    if body.mode == "ollama":
        ok, err, models, lat = await _fetch_ollama_tags(base)
    elif body.mode == "google":
        ok, err, models, lat = await _fetch_google_models(base, key)
    elif body.mode == "anthropic":
        ok, err, models, lat = await _fetch_anthropic_models(base, key)
    elif body.mode == "zhipu":
        ok, err, models, lat = await _fetch_zhipu_openai_style_models(base, key)
    else:
        ok, err, models, lat = await _fetch_openai_models(base, key)

    return LlmCheckResponse(
        ok=ok,
        latency_ms=lat,
        error=err,
        models=models,
    )
