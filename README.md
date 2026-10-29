# mall-api

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

### 3.1 修改表结构的安全流程（本机必读）

> ⚠️ **不要用 `pnpm prisma:migrate`（`migrate dev`）在本机改表！** 它在本地 MySQL 上会卡死（疑似 shadow database 创建挂住 / 弹重置交互），一旦被中断，会出现「库已改但迁移记录没写」的漂移，后续 `migrate deploy` 会重复执行同名迁移报错。

**本机安全落地 schema 变更的标准三步法：**

1. 改 `prisma/schema.prisma`（加字段 / 索引 / 模型）。
2. 用 **raw SQL** 真正改库（推荐写个一次性 `node` 脚本，先查后改、幂等）：
   ```js
   // _alter.mjs（跑完即删）
   import prisma from './src/prisma.js'
   await prisma.$executeRawUnsafe(`ALTER TABLE \`User\` ADD COLUMN \`openid\` VARCHAR(191)`)
   await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX \`User_openid_key\` ON \`User\`(\`openid\`)`)
   await prisma.$disconnect()
   ```
3. 写迁移文件（只生成、不执行、不弹窗）：
   ```bash
   pnpm prisma:migrate --create-only --name add_user_openid
   ```
   如果第 2 步已经手动改过库，就**别让 `migrate` 再执行**，直接手写 `prisma/migrations/<时间戳>_<名>/migration.sql`，内容与第 2 步的 SQL 一致。
4. 把这条迁移**标记为已应用**（只写 `_prisma_migrations` 记录，不执行 SQL，避免重复建表/建索引）：
   ```bash
   pnpm exec prisma migrate resolve --applied <完整目录名，如 20261028150000_add_user_openid>
   ```
5. 重新生成 Prisma Client（让代码认识新字段，这一步不碰库）：
   ```bash
   pnpm prisma:generate
   ```

**要点澄清：**

| 命令 | 是否改库 | 说明 |
|---|---|---|
| `pnpm prisma:generate` | ❌ | 只生成 Client（TS 类型 + 查询函数） |
| `pnpm prisma:migrate`（`migrate dev`） | ✅ 但本机卡死 | 开发用，本机禁用 |
| `pnpm migrate:deploy` | ✅ | 生产用，执行未应用的迁移文件 |
| raw SQL（`ALTER TABLE` / `CREATE INDEX`） | ✅ | **本机真正改库的就是它** |
| `migrate resolve --applied <名>` | ❌ | 只把「我手动改过了」记到迁移历史 |

- **`AUTO_INCREMENT` 不会回退**：即使 `DELETE` 测试数据，自增 id 也不会归零，留下「空洞」无害（id 只是主键，不代表行数）。
- **生产环境**用 `pnpm migrate:deploy` 跑迁移文件；本地这套 raw SQL 流程是为了绕过本机 `migrate dev` 卡死，二者不要混用。
- 自查：`pnpm prisma:studio` 看数据；或用 `SHOW TABLES` / `SHOW INDEX FROM <表>` 核对表结构。

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
- **限流**：全局限流（除 `/api/health` 外，每 IP 15 分钟最多 200 次，超限 429）+ 登录/注册更严格限流（15 分钟最多 10 次）。限流为进程内计数，**多实例部署需换 Redis**。
- **请求体 / 上传限制**：`express.json` / `urlencoded` 限制 `1mb`；上传仅允许图片类型，单文件 ≤ 2MB，文件名由服务端生成（防路径穿越）。
- **输入校验**：所有写接口用 `zod` 校验入参，失败统一返回 400 并给出具体字段原因。
- **统一错误**：`AppError` 携带 status/code，由 `errorHandler` 统一输出；全局只有 `response.js` 出现 `res.json`。
- **权限隔离**：商品/文章写接口需 `authRequired + adminRequired`；订单金额由服务端按库内价重算，下单后按 `userId` 隔离查询（普通用户只能看自己的订单）。
- **注销能力**：`/api/auth/logout` 将当前 token 的 `jti` 拉黑使其立即失效（默认内存黑名单；**配了 `REDIS_URL` 且装了 `ioredis` 则自动走 Redis**，多实例共享）。
- **审计日志**：所有写操作（POST/PUT/PATCH/DELETE）在响应后记录一条 `audit` 日志（操作人 / 状态 / 耗时 / IP / 请求ID），供合规追溯；只读请求不记，不记请求体（防敏感信息落盘）。
- **软删除**：`User` / `Product` 增加 `deletedAt` 字段，查询层经 Prisma 扩展自动过滤已删除记录；商品删除接口改为置 `deletedAt`（而非物理删除）。
- **限流存储可插拔**：全局限流与登录限流默认进程内计数；配 `REDIS_URL`（+`ioredis`）后自动改走 Redis，多实例一致。
- **接口文档**：访问 `/api/docs`（Swagger UI）或 `/api/docs/openapi.json`（机器可读 OpenAPI 3.0），与 [API.md](./API.md) 互补。
- **可选 APM**：配 `SENTRY_DSN`（+`@sentry/node`）后自动上报异常到 Sentry；未装则无副作用。
- **启动校验**：缺少 `JWT_SECRET` / `DATABASE_URL` 直接报错退出。
- **日志**：结构化日志（控制台 + 可选文件），错误日志附脱敏请求体；`LOG_BODY=true` 才记录请求参数（默认关闭，避免泄露密码 / token）。

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

## 生产化清单（已做 / 待做）

按优先级梳理的可上生产前的补齐项（高优先级基本已落地）：

| 优先级 | 项 | 状态 |
|---|---|---|
| 高 | 全局限流 | ✅ 已做（进程内；配 `REDIS_URL` 自动改走 Redis） |
| 高 | 请求体 / 上传大小与类型限制 | ✅ 已做（1mb 请求体、2MB 图片、类型白名单） |
| 高 | JWT 注销黑名单 | ✅ 已做（`/api/auth/logout`；配 `REDIS_URL` 自动走 Redis 共享） |
| 中 | 数据库连接池调优 | ✅ 已说明（`DATABASE_URL` 加 `?connection_limit=10`，见 `.env.example`） |
| 中 | 监控 / APM | ✅ 可选：配 `SENTRY_DSN` + `@sentry/node` 自动上报 Sentry；默认无依赖 |
| 中 | 自动化测试 + CI/CD | ✅ 已有 `tests/api.test.js` + `.github/workflows/ci.yml`（MySQL 服务容器 + vitest） |
| 中 | Docker / 部署编排 | ✅ 已有 `Dockerfile`（多阶段）+ `docker-compose.yml`（MySQL） |
| 中 | 审计日志 | ✅ 已做（写操作自动记 `audit` 日志） |
| 中 | 软删除 | ✅ 已做（`User`/`Product` 的 `deletedAt` + Prisma 扩展自动过滤） |
| 中 | OpenAPI / 接口文档 | ✅ 已做（`/api/docs` Swagger UI + `/api/docs/openapi.json`） |
| 低 | 列表默认排序 + 上限 | ✅ 已做（商品按时间倒序，pageSize 上限 50） |

> 注：本机改表结构请走「[3.1 修改表结构的安全流程](#31-修改表结构的安全流程本机必读)」，切勿用 `migrate dev`（本机会卡死）。

## 接口文档

完整接口（认证 / 购物车 / 收货地址 / 订单等的请求、响应、鉴权约定）见 **[API.md](./API.md)**。

金额统一以「分」存储（`price` 单位为分），前端展示时换算为元。
