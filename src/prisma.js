import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

// ── 连接池调优 ───────────────────────────────────────────────
// Prisma 默认连接数 = 机器逻辑核数 * 2 + 1。在多核生产机 / 多实例部署时，
// 这个值很容易打满 MySQL 的 max_connections（默认 151），报 "Too many connections"。
// 这里用「保守默认 + 环境变量可调」显式控制连接池，而不依赖 Prisma 的自动推导。
const pool = {
  // 单实例最多持有的数据库连接数。多实例部署务必满足：
  //   connection_limit × 实例数  ≤  MySQL max_connections（建议留余量）
  connection_limit: Number(process.env.PRISMA_CONNECTION_LIMIT ?? 10),
  // 从池里借不到连接时，最多等待多少秒就报错（默认 10s）。
  // 调小能让饱和的池「快速失败」返回 5xx，而不是让请求卡住 10s。
  pool_timeout: Number(process.env.PRISMA_POOL_TIMEOUT ?? 5),
  // 建立 TCP 连接的超时（秒），避免 MySQL 不可达时无限等待。
  connect_timeout: Number(process.env.PRISMA_CONNECT_TIMEOUT ?? 10),
  // 空闲连接超过该秒数后被回收，避免跨容器重启 / NAT 超时后出现「死连接」。
  socket_timeout: Number(process.env.PRISMA_SOCKET_TIMEOUT ?? 60),
}

// Prisma 只认连接串里的 query 参数，没有独立的连接池 env，
// 所以把上面的配置拼到 DATABASE_URL 上（已存在则不覆盖，保留手动写法）。
function withPoolParams(url) {
  const u = new URL(url)
  for (const [key, value] of Object.entries(pool)) {
    if (!u.searchParams.has(key)) u.searchParams.set(key, String(value))
  }
  return u.toString()
}

const datasourceUrl = withPoolParams(process.env.DATABASE_URL)

// PrismaClient 必须单例：别在每个请求里 new 一个，否则连接数会爆
const prisma = new PrismaClient({ datasourceUrl })

// 软删除：对 User / Product 的读/改/删操作，自动在 where 里补上 deletedAt: null，
// 业务层无需关心，已「删除」的记录在查询结果中天然不可见。
// 约定：真正删除（物理删除）请改用「置 deletedAt = now()」；目前只有列 + 查询拦截，
// 具体删除接口在需要时再实现为 UPDATE ... SET deletedAt = NOW()。
const SOFT_DELETE_MODELS = new Set(['User', 'Product'])
const SOFT_DELETE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
])

const prismaSoft = prisma.$extends({
  query: {
    $allModels({ model, operation, args, query }) {
      if (
        SOFT_DELETE_MODELS.has(model) &&
        SOFT_DELETE_OPS.has(operation) &&
        args &&
        args.where !== undefined
      ) {
        // 仅在没显式传 deletedAt 时才注入，支持「查已删除」之类的特殊场景
        if (args.where.deletedAt === undefined) {
          args.where = { ...args.where, deletedAt: null }
        }
      }
      return query(args)
    },
  },
})

export default prismaSoft
