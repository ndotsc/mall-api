# mall-api

![CI](https://github.com/ndotsc/mall-api/actions/workflows/ci.yml/badge.svg)

小型商城后端：Express 5 + Prisma 6 + MySQL。提供商品 / 文章 / 分类 / 订单 / 鉴权 / 上传接口，写接口需管理员 JWT。

## 环境要求

- Node 20+，pnpm 12
- MySQL 5.7+ / 8.x，已存在库 `mall` 与账号 `mall` / `mall123`（或自改 `DATABASE_URL`）

## 1. 安装依赖

```bash
pnpm install
```

> 构建审批已写入 `pnpm-workspace.yaml`（`permissions` 放行 prisma 构建），`pnpm install` 可正常生成 Prisma Client，无需手动 `approve-builds`。

## 2. 配置环境变量

项目需要 `.env`（不入库，已写入 `.gitignore`）。可复制 `.env.example` 后填写：

```bash
cp .env.example .env
```

`.env` 关键变量：

```dotenv
DATABASE_URL="mysql://mall:mall123@localhost:3306/mall"
JWT_SECRET="把下面命令的输出填进来"
CORS_ORIGINS="http://localhost:5173"   # 允许的跨域来源，多个用逗号分隔；生产填前端域名
PORT=3000                             # 可选，默认 3000
```

生成随机密钥：

```bash
openssl rand -base64 32
```

> 启动时若缺少 `JWT_SECRET` 或 `DATABASE_URL`，进程会明确报错并退出。

## 3. 数据库（Prisma）

```bash
pnpm prisma:generate   # prisma generate，生成 Prisma Client（CLI 与 client 同版本，已钉死 6.19.3）
pnpm prisma:migrate    # prisma migrate dev，首次建表；后续改动加 --name 命名迁移
pnpm db:seed           # node prisma/seed.js，写入种子数据（商品 / 文章 / 分类 + admin）
pnpm prisma:studio     # 浏览器打开 Prisma Studio 查看 / 编辑数据
```

> 版本说明：`prisma` 与 `@prisma/client` 必须同版本，本项目钉死 `6.19.3`。升级大版本前先看 release notes（7.x 有破坏性变更）。

> 不想本地装 MySQL？`docker compose up -d` 会按 `docker-compose.yml` 起一个 MySQL 8 容器（库 `mall`、账号 `mall/mall123`），开箱即用。

## 4. 运行

```bash
pnpm dev     # node --watch src/server.js，热重载，默认端口 3000
pnpm start   # 生产启动（不带 watch）
```

## 5. 追加依赖（示例）

```bash
pnpm add multer            # 运行时依赖
pnpm add -D prisma         # 开发依赖
```

## 安全与质量

- **安全响应头**：`helmet` 默认开启（图片经代理/跨域加载，已放开 CORP）。
- **跨域白名单**：`cors` 仅放行 `CORS_ORIGINS` 配置的来源，不再全开。
- **防爆破**：`/api/auth/login` 与 `/register` 限流（同 IP 15 分钟最多 10 次，超限 429）。
- **输入校验**：所有写接口用 `zod` 校验入参，失败统一返回 400 并给出具体字段原因。
- **统一错误**：`AppError` 携带 status/code，由 `errorHandler` 统一输出；全局只有 `response.js` 出现 `res.json`。
- **权限隔离**：商品/文章写接口需 `authRequired + adminRequired`；订单金额由服务端按库内价重算，下单后按 `userId` 隔离查询（普通用户只能看自己的订单）。
- **启动校验**：缺少 `JWT_SECRET` / `DATABASE_URL` 直接报错退出。

## 测试

```bash
pnpm test        # vitest run，执行 tests/api.test.js
pnpm test:watch  # 监听模式
```

> 测试连接 `DATABASE_URL` 指向的库，运行前会自建管理员与测试数据、运行后自动清理。CI（GitHub Actions）会拉起 MySQL 服务容器（库 `mall_test`）后跑同一套测试。

## 默认管理员账号（seed 写入）

```
username: admin
password: admin123        # role = 2
```

登录 `POST /api/auth/login` 拿到 JWT，`Authorization: Bearer <token>` 才能调写接口。

## 接口文档

完整接口（认证 / 购物车 / 收货地址 / 订单等的请求、响应、鉴权约定）见 **[API.md](./API.md)**。

金额统一以「分」存储（`price` 单位为分），前端展示时换算为元。
