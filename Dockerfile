# mall-api 生产镜像
# 用法：docker build -t mall-api . && docker run -p 3000:3000 --env-file .env mall-api
FROM node:22-alpine

WORKDIR /app

# 启用 pnpm（与本地版本 12.14.0 对齐）
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# 先装依赖（利用层缓存：依赖不变就不重装）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Prisma：迁移文件 + 生成客户端
COPY prisma ./prisma
RUN pnpm prisma generate

# 源码与静态资源
COPY src ./src
COPY public ./public

EXPOSE 3000

# 启动前先跑生产迁移，再起服务
CMD ["sh", "-c", "pnpm migrate:deploy && node src/server.js"]
