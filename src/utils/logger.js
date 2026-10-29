import fs from 'fs'
import path from 'path'

// 简易结构化日志：控制台始终输出；若设了 LOG_FILE 则同时追加 JSON 行到文件（生产用）
// 级别：debug < info < warn < error，由环境变量 LOG_LEVEL 控制（默认 info）
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase()
const LOG_FILE = process.env.LOG_FILE || ''
// 是否把请求体 / 查询参数写进日志（默认关闭！见下方说明）
const LOG_BODY = process.env.LOG_BODY === 'true'

let fileStream = null
if (LOG_FILE) {
  try {
    fileStream = fs.createWriteStream(path.resolve(LOG_FILE), { flags: 'a' })
  } catch (e) {
    console.error('[logger] 无法打开日志文件，回退控制台:', e.message)
  }
}

const COLOR = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', debug: '\x1b[90m' }
const RESET = '\x1b[0m'

// 敏感字段名（大小写不敏感）—— 这些字段的值在日志里一律替换为 ****
const SENSITIVE_KEYS = [
  'password', 'token', 'secret', 'authorization',
  'newpassword', 'confirmpassword', 'cookie', 'openid',
]

// 递归脱敏：遇到敏感 key 把值替换成 ****，对象 / 数组继续往下走；处理循环引用
export function redact(value, seen = new WeakSet()) {
  if (value == null || typeof value !== 'object') return value
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => redact(v, seen))
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    const key = String(k).toLowerCase()
    if (SENSITIVE_KEYS.includes(key)) out[k] = '****'
    else if (v && typeof v === 'object') out[k] = redact(v, seen)
    else out[k] = v
  }
  return out
}

function write(level, message, meta) {
  if ((LEVELS[level] || 99) < (LEVELS[LEVEL] || 20)) return
  const entry = {
    time: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
  }
  const payload = meta !== undefined
    ? (typeof meta === 'object' ? { ...entry, ...meta } : { ...entry, meta })
    : entry
  const line = JSON.stringify(payload)
  // 控制台：带级别颜色，便于肉眼看；文件：纯 JSON 行，便于采集（ELK / Loki）
  const tag = COLOR[level] || ''
  console.log(`${tag}[${entry.level}]${RESET} ${entry.time} ${message}`)
  if (fileStream) fileStream.write(line + '\n')
}

export const logger = {
  debug: (m, meta) => write('debug', m, meta),
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
  // 是否记录请求体 / 查询参数（由 LOG_BODY 控制，默认 false）
  shouldLogBody: () => LOG_BODY,
  redact,
}
