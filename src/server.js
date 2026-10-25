import app from './app.js'

// 启动前校验必需环境变量，缺失则明确报错并退出，避免运行时才暴露
if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error('[mall-api] 启动失败：缺少必需环境变量 JWT_SECRET / DATABASE_URL，请检查 .env（参考 .env.example）')
  process.exit(1)
}

const PORT = process.env.PORT || 3000

// server.js 只负责「把应用跑起来」，不写任何业务逻辑
const server = app.listen(PORT, () => {
  console.log(`[mall-api] 已启动: http://localhost:${PORT}/api/health`)
})

export default server
