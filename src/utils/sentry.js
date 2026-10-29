import { logger } from './logger.js'

// 可选 APM（Sentry）接入。
// @sentry/node 是「可选依赖」：未安装时下面的动态 import 会失败并自动跳过，业务零影响。
// 需要生产环境错误聚合 / 性能监控时，再 `pnpm add @sentry/node` 并在 .env 配 SENTRY_DSN。
let initialized = false

export async function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || initialized) return
  try {
    const Sentry = await import('@sentry/node')
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1, // 采样 10% 的事务，控制上报量
      release: process.env.APP_RELEASE || undefined,
    })
    initialized = true
    logger.info('[sentry] 已初始化 APM 上报')
  } catch (e) {
    logger.warn('[sentry] 未安装 @sentry/node，跳过 APM', { message: e.message })
  }
}

export async function captureError(err, ctx = {}) {
  if (!initialized) return
  try {
    const Sentry = await import('@sentry/node')
    Sentry.captureException(err, { extra: ctx })
  } catch {
    /* 上报失败不影响主流程 */
  }
}
