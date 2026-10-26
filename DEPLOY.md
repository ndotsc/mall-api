# 部署指南（DEPLOY）

商城后端 `mall-api`（Express 5 + Prisma 6 + MySQL 8）+ 前端 `mall-web`（Vue 3 + Vite）。
本文件给出环境变量清单与两条部署路线；选定平台后补全对应章节的具体操作。

## 1. 环境变量

### 后端 mall-api（生产必填）
| 变量 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | `mysql://mall:mall123@localhost:3306/mall` |
| `JWT_SECRET` | JWT 签名密钥，随机长串 | `openssl rand -hex 32` |
| `CORS_ORIGINS` | 允许的前端域名，逗号分隔（**异域部署必填**） | `https://mall.example.com` |
| `PORT` | 监听端口（PaaS 平台通常自动注入） | `3000` |
| `NODE_ENV` | 运行环境 | `production` |

> 本地开发见仓库根 `.env.example`；生产环境**不要**把 `.env` 提交进仓库。

### 前端 mall-web
| 变量 | 说明 |
|---|---|
| `VITE_API_BASE` | 异域部署时填后端公网地址（如 `https://api.example.com`）；同域 / Nginx 反代则**留空**（仍走相对路径 `/api`） |

## 2. 本地用 Docker 验证（推荐先跑通再上云）
```bash
# 后端：构建并起服务（需先准备 .env）
docker build -t mall-api .
docker run -p 3000:3000 --env-file .env mall-api
# 健康检查：curl http://localhost:3000/api/health

# 前端：本地构建产物即 dist/，交 Nginx 托管或本地 preview
pnpm build && pnpm preview
```

## 3. 路线 A：PaaS（Railway + Vercel，前后端异域）
- **后端**：Railway 新建 Project → 添加 MySQL 插件拿到 `DATABASE_URL` → Deploy 选 GitHub 仓库 `mall-api`（用仓库 Dockerfile）→ Variables 填 `JWT_SECRET` / `CORS_ORIGINS`（填前端域名）/ `PORT` → 生成后端域名（如 `https://mall-api.up.railway.app`）。
- **前端**：Vercel 导入 `mall-web` → Framework 选 Vite，Build `pnpm build`、Output `dist` → Environment 加 `VITE_API_BASE=https://后端域名` → Deploy。
- 异域下浏览器会跨域，后端 `CORS_ORIGINS` 必须包含前端域名，否则请求被拦。

## 4. 路线 B：自托管（轻量云 + Docker + Nginx，前后端同域）
- 服务器装 Docker；`docker run` 起 MySQL + 后端（或 `docker compose`）。
- Nginx 反代：`/` 托管前端 `dist` 静态文件，`/api`、`/uploads` 转发到后端容器。
- 前端 `VITE_API_BASE` 留空，构建后上传 `dist` 或由 Nginx 直接托管。
- 同域下无跨域，后端 `CORS_ORIGINS` 可省略；HTTPS 由 Nginx（Let's Encrypt）提供。

## 5. 健康检查
后端提供 `GET /api/health` → `{ status: 'ok', uptime: <秒> }`，部署平台用它判断实例存活。
