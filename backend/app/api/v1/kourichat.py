"""
KouriChat 启动管理 API

提供 KouriChat Web 配置界面的启动、停止、状态查询功能。
"""

import os
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/kourichat", tags=["KouriChat"])

# 动态计算项目根目录（MTC 仓库根目录）
def _find_project_root() -> Path:
    """从当前文件向上查找包含 kourichat 目录的项目根目录（MTC 仓库根）"""
    import sys

    # 策略1：从 __file__ 向上搜索（标准方式）
    module_file = getattr(sys.modules.get('app.api.v1.kourichat', None), '__file__', None)
    if module_file:
        current = Path(module_file).resolve().parent
        for _ in range(15):
            if (current / "kourichat").is_dir():
                return current
            parent = current.parent
            if parent == current:
                break
            current = parent

    # 策略2：尝试从 cwd 向上搜索
    cwd = Path.cwd()
    for _ in range(15):
        if (cwd / "kourichat").is_dir():
            return cwd
        parent = cwd.parent
        if parent == cwd:
            break
        cwd = parent

    # 策略3：尝试直接检测可能的固定路径
    possible_roots = [
        Path(__file__).resolve().parent,  # 从当前文件位置
        Path.cwd(),                       # 从工作目录
    ]
    for base in possible_roots:
        for _ in range(20):
            if (base / "kourichat").is_dir() and (base / "backend").is_dir():
                return base
            parent = base.parent
            if parent == base:
                break
            base = parent

    raise RuntimeError(
        f"无法找到 MTC 项目根目录（kourichat 目录未找到），"
        f"当前文件：{__file__}，当前目录：{Path.cwd()}"
    )

PROJECT_ROOT = _find_project_root()
KOURICHAT_DIR = PROJECT_ROOT / "kourichat"
WEB_SCRIPT = KOURICHAT_DIR / "run_config_web.py"
DEFAULT_PORT = 8502

# 动态端口存储（由 run_config_web.py 启动后写入）
_dynamic_port_file = KOURICHAT_DIR / "data" / ".running_port"

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
        if _dynamic_port_file.exists():
            return int(_dynamic_port_file.read_text().strip())
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

    if not WEB_SCRIPT.exists():
        raise HTTPException(
            status_code=404,
            detail=f"KouriChat Web 脚本未找到：{WEB_SCRIPT}",
        )

    env = os.environ.copy()
    # 禁用可能冲突的包
    env["WERKZEUG_RUN_MAIN"] = "true"

    def _run():
        global _process
        try:
            proc = subprocess.Popen(
                ["python", str(WEB_SCRIPT)],
                cwd=str(KOURICHAT_DIR),
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
