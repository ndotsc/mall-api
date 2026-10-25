import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/error.js'
import path from 'path'

// app.js 只负责「组装应用」，不负责启动（启动在 server.js）
const app = express()

// 1. 安全响应头（图片经由前端代理/跨域加载，放开 CORP 以免被拦）
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// 2. 跨域白名单：默认放行本地前端；生产环境用 CORS_ORIGINS 配多个域名（逗号分隔）
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors({ origin: allowedOrigins }))

// 3. 解析 JSON 请求体（前端 POST 的 JSON 靠它才能被 req.body 读到）
//    必须放在路由之前，否则路由里读不到 body
app.use(express.json())

app.use('/uploads', express.static(path.resolve('public/uploads')))

// 4. 业务路由：所有接口挂在 /api 前缀下
app.use('/api', routes)

// 5. 404 兜底：前面所有路由都没命中，才走到这里
//    （Express 5 不能写 app.get('*')，用中间件兜底）
app.use(notFound)

// 6. 错误处理：必须放最后，且函数签名必须是 4 个参数 (err, req, res, next)
//    Express 靠「参数数量是 4」来识别它是错误中间件
app.use(errorHandler)

export default app
