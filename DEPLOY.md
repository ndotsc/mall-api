# 部署指南（DEPLOY）

商城后端 `mall-api`（Express 5 + Prisma 6 + MySQL 8）+ 前端 `mall-web`（Vue 3 + Vite）。
本文从「本地验证」到「上云」给出可执行步骤。选定路线后按顺序操作即可。

---

## 1. 环境变量

### 后端 mall-api（生产必填）
| 变量 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | `mysql://mall:mall123@localhost:3306/mall` |
| `JWT_SECRET` | JWT 签名密钥，随机长串 | `openssl rand -hex 32` |
| `CORS_ORIGINS` | 允许的前端域名，逗号分隔（**异域部署必填**） | `https://mall.example.com` |
| `PORT` | 监听端口（PaaS 平台通常自动注入） | `3000` |
| `NODE_ENV` | 运行环境 | `production` |

> 本地开发见仓库根 `.env.example`；生产环境**绝对不要把 `.env` 提交进仓库**（`.gitignore` 已忽略）。

### 前端 mall-web
| 变量 | 说明 |
|---|---|
| `VITE_API_BASE` | 异域部署时填后端公网地址（如 `https://api.example.com`）；同域 / Nginx 反代则**留空**（仍走相对路径 `/api`） |

---

## 2. 本地验证（推荐先跑通，不出公网）

目标：用 Docker 起 MySQL + 后端，前端用 `pnpm dev` 联调，确认「部署配置本身」没问题。

### 2.1 起后端 + 数据库
```bash
cd mall-api
docker compose up -d        # 起 mysql + backend（backend 会自动 prisma migrate deploy 再启动）
docker compose logs -f backend   # 看日志，出现 "已启动: http://localhost:3000/api/health" 即成功
```

### 2.2 验证后端健康
```bash
curl http://localhost:3000/api/health
# 期望返回：{"status":"ok","uptime":<秒>}
```

### 2.3 起前端联调
```bash
cd ../mall-web
pnpm dev                    # 打开 http://localhost:5173
# 前端 /api 经 Vite dev proxy 转发到 localhost:3000（后端容器映射端口），无需改代码
```
浏览器实测：注册 → 登录（admin/admin123 可进后台）→ 浏览商品 → 下单 → 查我的订单。

### 2.4 收尾
```bash
cd mall-api && docker compose down      # 停容器（数据卷保留，下次 up 仍在）
# 彻底清数据：docker compose down -v
```

> 想验证「生产构建」形态：前端 `pnpm build` 后 `pnpm preview`，此时无 Vite proxy，
> 需临时设 `VITE_API_BASE=http://localhost:3000` 再 build，或本地用 Nginx 反代（见 §4.3）。

---

## 3. 路线 A：PaaS（Railway + Vercel，前后端异域）

适合：想最快上线、不在乎国内访问速度。无需自有服务器。

### 3.1 后端 → Railway
1. 注册 [Railway](https://railway.app)，New Project → Deploy from GitHub repo → 选 `mall-api`。
2. Railway 会自动识别 Dockerfile 构建镜像。
3. 在 Project 里 **Add → Database → MySQL**，建好后点 MySQL 服务，复制其 `DATABASE_URL`。
4. 在 `mall-api` 服务的 **Variables** 里添加：
   - `DATABASE_URL` = 上一步复制的 MySQL 连接串
   - `JWT_SECRET` = `openssl rand -hex 32` 生成的随机串
   - `CORS_ORIGINS` = 前端上线后的域名（如 `https://mall-web.vercel.app`，多个用逗号）
   - `NODE_ENV` = `production`
   - （Railway 会自动注入 `PORT`，无需手填）
5. Deploy 完成后，Railway 给一个域名（如 `https://mall-api.up.railway.app`）。
   `curl https://<你的域名>/api/health` 验证。

### 3.2 前端 → Vercel
1. 注册 [Vercel](https://vercel.com)，Import Git Repository → 选 `mall-web`。
2. Framework Preset 选 **Vite**；Build Command `pnpm build`；Output Directory `dist`。
3. 在 **Environment Variables** 加：`VITE_API_BASE` = `https://<Railway给的后端域名>`（**不带 `/api`**）。
4. Deploy。Vercel 给域名（如 `https://mall-web.vercel.app`）。
5. **回到 Railway** 把 `CORS_ORIGINS` 补上 Vercel 域名（异域必须，否则浏览器跨域被拦），Redeploy 后端。

### 3.3 验证
浏览器打开 Vercel 域名，注册/登录/下单走一遍；F12 Network 看请求是否发往 Railway 域名、是否 200。

---

## 4. 路线 B：自托管（轻量云 + Docker + Nginx，前后端同域）

适合：国内访问快、最像真实产品。需要一台云服务器（腾讯云/阿里云轻量应用服务器，约 ¥50–100/月）。

### 4.1 服务器准备
1. 买轻量应用服务器（系统选 Ubuntu 22.04），在控制台**放行端口 80/443/22**。
2. SSH 登录，安装 Docker + Docker Compose：
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # 退出重登生效
   docker --version && docker compose version
   ```
3. 把 `mall-api` 代码传上去（git clone 你的 GitHub 仓库最方便）：
   ```bash
   git clone https://github.com/ndotsc/mall-api.git && cd mall-api
   ```

### 4.2 起后端 + MySQL
修改 `docker-compose.yml` 的 `backend.environment`：
- `DATABASE_URL` 保持容器内 `mysql://mall:mall123@mysql:3306/mall`
- `JWT_SECRET` 改成 `openssl rand -hex 32` 的值
- `CORS_ORIGINS` 可留空或填你的域名（同域下其实不跨域，可不填）
- `NODE_ENV=production`
然后：
```bash
docker compose up -d
curl http://localhost:3000/api/health   # 服务器本机验证
```

### 4.3 Nginx 反代 + 托管前端（同域）
安装 Nginx：`sudo apt install -y nginx`。
把前端构建产物传上来并放好：`pnpm build` 后把 `dist/` 上传到服务器 `/var/www/mall-web/`。
写站点配置 `/etc/nginx/sites-available/mall`：
```nginx
server {
    listen 80;
    server_name mall.example.com;   # 换成你的域名，并先 A 记录指向本机

    # 前端静态文件
    root /var/www/mall-web;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;   # SPA 路由回退
    }

    # 后端接口：同域反代，前端 /api 零改动
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    # 上传的图片
    location /uploads/ {
        proxy_pass http://localhost:3000;
    }
}
```
启用：`sudo ln -s /etc/nginx/sites-available/mall /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`。

### 4.4 HTTPS（Let's Encrypt，免费）
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d mall.example.com   # 自动签发并改写配置为 443
```
证书 90 天自动续期。

### 4.5 验证
浏览器开 `https://mall.example.com`，注册/登录/下单走一遍。

---

## 5. 健康检查与排错

- 后端 `GET /api/health` → `{"status":"ok","uptime":<秒>}`，部署平台用它探活。
- **白屏 / 404**：SPA 需 `try_files` 回退到 `index.html`（§4.3）。
- **跨域报错**：异域部署时后端 `CORS_ORIGINS` 必须包含前端域名；同域反代不触发跨域。
- **迁移失败**：确认 `DATABASE_URL` 正确且 MySQL 可达；`docker compose logs backend` 看 `migrate deploy` 输出。
- **图片不显示**：确认 `/uploads/` 已反代（同域）或前端图片地址走的是后端域名（异域）。
