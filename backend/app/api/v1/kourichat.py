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

# KouriChat 目录（相对于项目根目录）
KOURICHAT_DIR = Path(__file__).parent.parent.parent.parent / "kourichat"
WEB_SCRIPT = KOURICHAT_DIR / "run_config_web.py"
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
    """启动 KouriChat Web 配置界面"""
    global _process

    if _process is not None and _process.poll() is None:
        port = DEFAULT_PORT
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

    # 查找可用端口
    try:
        port = _find_available_port(DEFAULT_PORT)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

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

    # 等待服务就绪（最多 15 秒）
    for _ in range(30):
        time.sleep(0.5)
        if _check_port_in_use(port):
            return StartResponse(
                status="started",
                url=_get_web_url(port),
                port=port,
                message=f"KouriChat Web 界面启动成功",
            )

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
    """获取 KouriChat Web 界面运行状态"""
    global _process

    with _process_lock:
        if _process is not None and _process.poll() is None:
            port = DEFAULT_PORT
            return StatusResponse(
                status="running",
                url=_get_web_url(port),
                port=port,
                pid=_process.pid,
            )
        elif _process is not None:
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
