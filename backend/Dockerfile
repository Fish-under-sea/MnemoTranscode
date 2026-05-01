# MTC Backend Dockerfile

FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .
# 构建期校验：避免旧缓存镜像缺 Pillow 却在运行时才因 import PIL 崩溃
RUN pip install --no-cache-dir -r requirements.txt \
    && python -c "from PIL import Image; print('pillow_ok')"

# 复制应用代码
COPY . .
RUN chmod +x /app/entrypoint.sh

# 创建非 root 用户
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/healthz || exit 1

# 启动入口（先迁移再启动）
ENTRYPOINT ["/app/entrypoint.sh"]
