"""
KouriChat 启动管理 API

提供 KouriChat Web 配置界面的启动、停止、状态查询功能。
"""

import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/kourichat", tags=["KouriChat"])

def _kourichat_dir_mtc_repo_layout() -> Path | None:
    """标准 MTC 单仓布局：项目根下与 backend/ 同级的 kourichat/（<MTC>/kourichat/run_config_web.py）。

    自本文件所在目录沿父链向上，找到同时含有 backend/ 与 kourichat/run_config_web.py 的目录，返回 kourichat/ 绝对路径。
    """
    script = "run_config_web.py"
    start = Path(__file__).resolve().parent
    for d in (start, *start.parents):
        if not d.is_dir():
            continue
        if not (d / "backend").is_dir():
            continue
        kc = d / "kourichat"
        if (kc / script).is_file():
            return kc.resolve()
    return None


def _find_kourichat_from_file_parents() -> Path | None:
    """自 kourichat.py 包路径向上遍历，若任一层下存在子目录 kourichat/run_config_web.py 则采用（兼容非标准落盘）。"""
    script = "run_config_web.py"
    start = Path(__file__).resolve().parent
    for d in (start, *start.parents):
        kc = d / "kourichat"
        if (kc / script).is_file():
            return kc.resolve()
    return None


def _resolve_kourichat_dir() -> Path:
    """每次请求时重新解析。勿在 KOURICHAT_DIR 仅存在目录但无脚本时早退。

    顺序：KOURICHAT_DIR（仅当 run_config_web.py 存在）→ 标准 MTC 仓 → 自源码上溯 kourichat/ →
    /kourichat 挂载 → 其它。最终占位**固定为 /kourichat**，不再使用 cwd/…/kourichat（在容器里 cwd 多为 /app，会误报 /app/kourichat）。
    """
    script = "run_config_web.py"
    raw = (os.environ.get("KOURICHAT_DIR") or "").strip()
    if raw:
        p = Path(raw).resolve()
        if (p / script).is_file():
            return p
        # 有变量但无脚本：不返回空目录，继续走后续候选（含 /kourichat 挂载）
    mtc_kc = _kourichat_dir_mtc_repo_layout()
    if mtc_kc is not None:
        return mtc_kc
    from_parents = _find_kourichat_from_file_parents()
    if from_parents is not None:
        return from_parents
    docker_mnt = Path("/kourichat").resolve()
    if (docker_mnt / script).is_file():
        return docker_mnt
    for extra in (Path("/mtc-kourichat"),):
        e = extra.resolve()
        if (e / script).is_file():
            return e
    p_app_parent = Path.cwd().parent
    if p_app_parent != Path.cwd():
        sibling = (p_app_parent / "kourichat").resolve()
        # 不采用 /app/kourichat：与 /k 挂载重复且易与 WORKDIR 混淆，统一走下方 /kourichat
        if sibling == Path("/app/kourichat").resolve():
            pass
        elif (sibling / script).is_file():
            return sibling
    # 与 compose 中 ../kourichat:/kourichat 对齐；无脚本时 404 文案也引导至此路径而非 /app/…
    return Path("/kourichat").resolve()


def get_kourichat_dir() -> Path:
    return _resolve_kourichat_dir()


def get_web_script_path() -> Path:
    return get_kourichat_dir() / "run_config_web.py"


def get_dynamic_port_file_path() -> Path:
    return get_kourichat_dir() / "data" / ".running_port"


DEFAULT_PORT = 8502

# 进程状态存储
_process: subprocess.Popen | None = None
_process_lock = threading.Lock()


class StartResponse(BaseModel):
    status: str
    url: str
    port: int
    message: str


class StatusResponse(BaseModel):
    status: Literal["running", "stopped", "starting"]
    url: str | None
    port: int
    pid: int | None


def _check_port_in_use(port: int) -> bool:
    """检查端口是否被占用"""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return False
        except OSError:
            return True


def _get_actual_port() -> int:
    """获取实际运行的端口（优先从动态文件读取，否则用默认端口）"""
    try:
        fp = get_dynamic_port_file_path()
        if fp.exists():
            return int(fp.read_text().strip())
    except Exception:
        pass
    return DEFAULT_PORT


def _check_actual_service() -> bool:
    """检查实际服务是否就绪（尝试连接到动态端口或默认端口）"""
    import socket
    port = _get_actual_port()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result = s.connect_ex(("127.0.0.1", port))
            return result == 0
    except Exception:
        return False


def _find_available_port(start: int = DEFAULT_PORT) -> int:
    """查找可用端口"""
    port = start
    while port < start + 100:
        if not _check_port_in_use(port):
            return port
        port += 1
    raise RuntimeError(f"无法找到可用端口（从 {start} 开始）")


def _get_web_url(port: int) -> str:
    return f"http://127.0.0.1:{port}"


@router.post("/start", response_model=StartResponse)
async def start_web():
    """启动 KouriChat Web 配置界面

    如果 Flask 已经通过其他方式在运行（外部启动），直接返回成功。
    """
    global _process

    port = DEFAULT_PORT

    # 如果端口已经在被监听，说明 Flask 已经启动了
    if _check_port_in_use(port):
        return StartResponse(
            status="already_running",
            url=_get_web_url(port),
            port=port,
            message="KouriChat Web 界面已在运行中",
        )

    # 检查内部进程是否存活
    with _process_lock:
        alive = _process is not None and _process.poll() is None

    if alive:
        return StartResponse(
            status="already_running",
            url=_get_web_url(port),
            port=port,
            message="KouriChat Web 界面已在运行中",
        )

    web_script = get_web_script_path()
    kc_dir = get_kourichat_dir()
    if not web_script.is_file():
        raise HTTPException(
            status_code=404,
            detail=(
                f"KouriChat Web 脚本未找到：{web_script}。"
                f" 请在 compose 中挂载宿主 kourichat 到 /kourichat，或设置 KOURICHAT_DIR；"
                f" 当前探测目录为 {kc_dir}。"
            ),
        )

    env = os.environ.copy()
    # 禁用可能冲突的包
    env["WERKZEUG_RUN_MAIN"] = "true"

    def _run():
        global _process
        try:
            proc = subprocess.Popen(
                [sys.executable, str(web_script)],
                cwd=str(kc_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            with _process_lock:
                _process = proc
            proc.wait()
        except Exception:
            pass
        finally:
            with _process_lock:
                _process = None

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    # 等待服务就绪（最多 45 秒）
    for i in range(90):
        time.sleep(0.5)
        if _check_port_in_use(port):
            return StartResponse(
                status="started",
                url=_get_web_url(port),
                port=port,
                message=f"KouriChat Web 界面启动成功",
            )

    # 45秒后仍未就绪，返回 starting 状态让前端继续轮询
    return StartResponse(
        status="starting",
        url=_get_web_url(port),
        port=port,
        message="KouriChat Web 界面正在启动中，请稍后刷新页面",
    )


@router.post("/stop")
async def stop_web():
    """停止 KouriChat Web 配置界面"""
    global _process

    with _process_lock:
        if _process is None or _process.poll() is not None:
            return {"status": "stopped", "message": "KouriChat Web 界面已停止"}

        try:
            if os.name == "nt":
                _process.terminate()
            else:
                os.kill(_process.pid, signal.SIGTERM)
            _process.wait(timeout=5)
        except Exception:
            try:
                if os.name == "nt":
                    _process.kill()
                else:
                    os.kill(_process.pid, signal.SIGKILL)
            except Exception:
                pass
        finally:
            _process = None

    return {"status": "stopped", "message": "KouriChat Web 界面已停止"}


@router.get("/status", response_model=StatusResponse)
async def get_status():
    """获取 KouriChat Web 界面运行状态

    检测逻辑（优先级从高到低）：
    1. 如果内部 _process 存在且存活 → running
    2. 如果端口实际可连接（外部启动的 Flask） → running
    3. 否则 → stopped
    """
    global _process

    with _process_lock:
        # 优先级1：内部进程是否存活
        if _process is not None and _process.poll() is None:
            port = _get_actual_port()
            return StatusResponse(
                status="running",
                url=_get_web_url(port),
                port=port,
                pid=_process.pid,
            )

    # 优先级2：端口是否实际可连接（支持外部启动的 Flask）
    port = _get_actual_port()
    if _check_port_in_use(port):
        return StatusResponse(
            status="running",
            url=_get_web_url(port),
            port=port,
            pid=None,
        )

    # 优先级3：进程存在但已退出
    if _process is not None:
        return StatusResponse(
            status="stopped",
            url=None,
            port=DEFAULT_PORT,
            pid=None,
        )

    return StatusResponse(
        status="stopped",
        url=None,
        port=DEFAULT_PORT,
        pid=None,
    )
