# MTC Frontend Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
# 使用 /etc/nginx/templates/*.template 由官方 entrypoint 做 envsubst 生成 conf.d
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx-snippets/ /etc/nginx/snippets/
ENV API_UPSTREAM=backend:8000
# 全栈 Nginx 代理 KouriChat 时的上游 host:port（与 compose 覆盖一致；无服务时 upstream 502 属预期）
ENV KOURICHAT_UPSTREAM=host.docker.internal:8502

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
