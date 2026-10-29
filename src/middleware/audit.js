import { logger, redact } from '../utils/logger.js'
import prisma from '../prisma.js'

// 审计日志：对所有「会改变数据的请求」（POST/PUT/PATCH/DELETE）在响应结束后记录一条，
// 包含 方法 / 路径 / 状态码 / 操作人(userId) / 被操作资源id / IP / 耗时 / 请求ID，
// 便于事后追溯「谁在什么时间对哪个资源做了什么动作、结果如何」。
// 只读请求（GET/HEAD/OPTIONS）不记，避免日志量爆炸。
//
// 关于「改前 / 改后 diff」：
//  - 基础字段（谁/何时/哪个资源/什么动作/结果）始终记录，不含敏感信息；
//  - 仅在 LOG_BODY=true 时，额外抓取「改前」记录（handler 执行前按 id 反查 DB）并和
//    「改后」（已脱敏的请求体）做浅比对，输出 diff。这样默认零泄露，需要细查时开开关即可。
//  - 真正的事前/事后全量字段审计属于更重的子系统，mall 当前不需要。
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// URL 首段 -> Prisma model 名；命中不了就只记基础审计，不影响主流程。
const PATH_TO_MODEL = {
  products: 'product',
  users: 'user',
  orders: 'order',
  addresses: 'address',
  categories: 'category',
  articles: 'article',
  cart: 'cart',
}

// 各 model 的主键字段名（Order 用 orderNo，其余用 id）
function idFieldOf(model) {
  return model === 'order' ? 'orderNo' : 'id'
}

function modelFromPath(url) {
  const seg = (url || '').split('?')[0].split('/').filter(Boolean)
  if (seg[0] === 'api') seg.shift()
  return PATH_TO_MODEL[seg[0]] || null
}

// 浅比对：返回「值发生变化的字段 -> { from, to }」
function shallowDiff(before, after) {
  const diff = {}
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
      diff[k] = { from: before?.[k] ?? null, to: after?.[k] ?? null }
    }
  }
  return diff
}

export async function auditLog(req, res, next) {
  if (!MUTATING.has(req.method)) return next()

  const start = Date.now()
  const resourceId =
    req.params && Object.keys(req.params).length
      ? Object.values(req.params).join('/')
      : null
  const model = modelFromPath(req.originalUrl)
  const pk = idFieldOf(model)
  const idVal = req.params?.[pk]

  // 仅在开启 LOG_BODY 时抓取「改前」记录（handler 执行前），避免默认泄露敏感字段
  let before
  if (logger.shouldLogBody() && model && idVal != null && req.method !== 'POST') {
    try {
      const rec = await prisma[model].findUnique({ where: { [pk]: idVal } })
      before = rec ? redact(rec) : null
    } catch {
      before = null // 反查失败不影响主流程
    }
  }

  res.on('finish', () => {
    const entry = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      userId: req.user?.userId ?? null, // 未登录写 null
      resourceId,
      ip: req.ip,
      ms: Date.now() - start,
      reqId: req.id, // 与访问日志 / 错误日志串联
    }

    // 仅在显式开启 LOG_BODY 时附带（已脱敏的）请求体 + 改前/改后 diff
    if (logger.shouldLogBody()) {
      const after = req.body ? redact(req.body) : null
      entry.before = before ?? null
      entry.after = after
      if (before && after) entry.diff = shallowDiff(before, after)
    }

    logger.info('audit', entry)
  })
  next()
}
