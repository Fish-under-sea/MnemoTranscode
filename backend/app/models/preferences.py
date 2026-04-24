"""
用户偏好模型 — 存储用户的 UI 偏好和设置
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserPreferences(Base):
    """用户偏好设置"""

    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # 主题相关
    theme = Column(String(20), default="light")
    primary_color = Column(String(30), default="jade")
    card_style = Column(String(20), default="glass")
    font_size = Column(String(10), default="medium")
    dashboard_layout = Column(String(20), default="grid")

    # 自定义
    custom_css = Column(Text, nullable=True)
    # 主应用区背景图 URL（全屏铺底，与 DIY UI 同步）
    app_background_url = Column(String(1024), nullable=True)

    # AI 记忆同步
    ai_memory_sync = Column(String(10), default="on")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<UserPreferences user={self.user_id} theme={self.theme}>"
