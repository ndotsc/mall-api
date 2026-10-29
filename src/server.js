import app from './app.js'
import prisma from './prisma.js'
import { logger } from './utils/logger.js'
import { initSentry } from './utils/sentry.js'

// 启动前校验必需环境变量，缺失则明确报错并退出，避免运行时才暴露
if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  logger.error('启动失败：缺少必需环境变量 JWT_SECRET / DATABASE_URL，请检查 .env（参考 .env.example）')
  process.exit(1)
}

// 可选 APM：配了 SENTRY_DSN（且装了 @sentry/node）才初始化，否则无副作用
initSentry()

const PORT = process.env.PORT || 3000

// server.js 只负责「把应用跑起来」，不写任何业务逻辑
const server = app.listen(PORT, () => {
  logger.info('mall-api 已启动', {
    port: PORT,
    health: `http://localhost:${PORT}/api/health`,
  })
})

// 优雅停机：容器编排（K8s / Docker / PM2）停止实例时会发 SIGTERM。
// 流程：停止接收新连接 -> 等存量请求处理完 -> 断开 DB 连接 -> 退出。
// 没有这一步，进程会被直接 kill，正在进行的请求会 5xx，Prisma 连接也不会释放。
async function shutdown(signal) {
  logger.warn(`收到 ${signal}，开始优雅停机…`)
  server.close(() => logger.info('HTTP 服务已停止接收新连接'))
  try {
    await prisma.$disconnect()
    logger.info('数据库连接已断开')
  } catch (e) {
    logger.error('断开数据库时出错', { message: e.message })
  }
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default server
