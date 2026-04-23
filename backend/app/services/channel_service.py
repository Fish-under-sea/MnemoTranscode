"""
多渠道消息转接服务

整合 KouriChat 微信消息处理逻辑，支持：
1. 原生软件内对话
2. 微信聊天转接
3. QQ 聊天转接（待开发）
"""

import asyncio
import logging
from typing import Literal, Callable
from enum import Enum

logger = logging.getLogger(__name__)


class ChannelType(str, Enum):
    """消息渠道类型"""
    APP = "app"       # 原生应用内对话
    WECHAT = "wechat" # 微信
    QQ = "qq"         # QQ


class MessageRouter:
    """
    消息路由服务

    核心职责：
    1. 接收来自不同渠道的消息
    2. 统一格式后路由到对话服务
    3. 将回复分发回对应渠道
    """

    def __init__(self):
        self._handlers: dict[ChannelType, Callable] = {}
        self._subscribers: list[Callable] = []

    def register_handler(self, channel: ChannelType, handler: Callable):
        """注册渠道消息处理器"""
        self._handlers[channel] = handler
        logger.info(f"已注册 {channel.value} 渠道的消息处理器")

    def subscribe(self, callback: Callable):
        """订阅所有消息"""
        self._subscribers.append(callback)

    async def route_message(
        self,
        channel: ChannelType,
        user_id: str,
        content: str,
        metadata: dict | None = None,
    ) -> dict:
        """
        路由消息到对应处理器

        返回处理结果
        """
        if channel not in self._handlers:
            logger.warning(f"未注册 {channel.value} 渠道的处理器")
            return {"error": f"不支持的渠道: {channel.value}"}

        handler = self._handlers[channel]
        result = await handler(user_id, content, metadata or {})

        # 通知订阅者
        for callback in self._subscribers:
            asyncio.create_task(callback(channel, user_id, content, result))

        return result


class WeChatMessageHandler:
    """
    微信消息处理器

    整合 KouriChat 的微信消息处理核心逻辑
    基于 wxautox4 库实现
    """

    def __init__(self):
        self._wx_instance = None
        self._running = False

    async def start_listening(self, listen_list: list[str] | None = None):
        """
        启动微信消息监听

        整合了 KouriChat src/main.py 的核心逻辑
        """
        try:
            from wxauto import WeChat

            self._wx_instance = WeChat()
            if listen_list:
                for chat_name in listen_list:
                    self._wx_instance.AddListenChat(chat_name)
            else:
                self._wx_instance.AddListenChat(with_chat=True)

            self._running = True
            logger.info("微信消息监听已启动")

            # 启动消息监听循环
            asyncio.create_task(self._listen_loop())

        except ImportError:
            logger.error("wxautox4 未安装，请运行: pip install wxautox4")
        except Exception as e:
            logger.error(f"启动微信监听失败: {e}")

    async def stop_listening(self):
        """停止微信消息监听"""
        self._running = False
        logger.info("微信消息监听已停止")

    async def _listen_loop(self):
        """消息监听循环"""
        while self._running:
            try:
                msgs = self._wx_instance.GetListenMessage()
                for msg in msgs:
                    await self._process_message(msg)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"监听循环出错: {e}")
                await asyncio.sleep(1)

    async def _process_message(self, msg):
        """处理单条微信消息"""
        sender = msg.get("sender", "")
        content = msg.get("content", "")
        msg_type = msg.get("type", "text")

        logger.info(f"收到微信消息 from {sender}: {content[:50]}")

        # TODO: 路由到对话服务
        # reply = await dialogue_service.chat(content, channel="wechat", user_id=sender)

        # self._wx_instance.SendMessage(reply, friend=sender)

    async def send_message(self, friend: str, content: str):
        """发送微信消息"""
        if self._wx_instance:
            self._wx_instance.SendMessage(content, friend=friend)

    async def send_files(self, friend: str, file_paths: list[str]):
        """发送文件/图片"""
        if self._wx_instance:
            for path in file_paths:
                self._wx_instance.SendFiles(path, friend=friend)


class QQMessageHandler:
    """
    QQ 消息处理器（待开发）

    占位实现，后续可接入 NoneBot 或 go-cqhttp
    """

    async def start_listening(self):
        """启动 QQ 消息监听"""
        raise NotImplementedError("QQ 消息处理功能待开发")

    async def send_message(self, group_id: str, content: str):
        """发送 QQ 群消息"""
        raise NotImplementedError("QQ 消息处理功能待开发")
