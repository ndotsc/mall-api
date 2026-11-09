// 图片 URL 契约（三套后端行为一致，详见 backend/README.md「图片 URL 与共享上传目录」）：
//
//   数据库：只存相对路径 `/uploads/xxx.png` —— 换域名、换后端、换端口都不会让数据失效
//   接口：  一律返回**完整 URL** —— 前端跨域部署时不再依赖 vite proxy 转发 /uploads
//   入参：  前端可以直接把上传接口返回的完整 URL 回填到 cover/avatar，写库前自动还原成相对路径
//
// 完整 URL 的 origin 优先级：PUBLIC_ORIGIN（生产 / CDN / 反向代理必配） > 当前请求的 scheme://host
// 约定：业务字段里凡是 `/uploads/` 开头的字符串，都视为本系统上传的图片路径。
const UPLOAD_PREFIX = '/uploads/'

// 匹配 http(s)://host/uploads/... 与 //host/uploads/...，保留 query / hash
const ABSOLUTE_UPLOAD = /^(?:https?:)?\/\/[^/]+(\/uploads\/[^?#]*)([?#].*)?$/i

/** 对外可访问的 origin（协议 + 域名 + 端口），不带尾斜杠 */
export function publicOrigin(req) {
    const configured = (process.env.PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '')
    if (configured) return configured
    if (!req) return ''
    const proto = (req.protocol || 'http').split(',')[0].trim()
    const rawHost = typeof req.get === 'function' ? req.get('host') : req.headers?.host
    const host = String(rawHost || '').split(',')[0].trim()
    return host ? `${proto}://${host}` : ''
}

/** 相对路径 → 完整 URL；外链 / data: / 已是完整 URL 的原样返回 */
export function toPublicUrl(value, origin) {
    if (!origin || typeof value !== 'string' || !value) return value
    if (value.startsWith(UPLOAD_PREFIX)) return origin + value
    return value
}

/** 本系统上传路径的完整 URL → 相对路径（写库前用）；相对路径 / 外链原样返回 */
export function toStoragePath(value) {
    if (typeof value !== 'string' || !value) return value
    const m = value.match(ABSOLUTE_UPLOAD)
    return m ? m[1] + (m[2] || '') : value
}

// 递归遍历响应/请求体。只处理普通对象、数组、字符串；Date/Buffer 等原样透传，
// 深度上限 8 防止异常数据导致栈溢出。
// 无改动时返回**原对象引用**（不重建），避免每个请求 / 响应都白深拷贝一次 data。
function walk(data, fn, depth = 0) {
    if (data == null || depth > 8) return data
    if (typeof data === 'string') return fn(data)
    if (typeof data !== 'object') return data
    if (data instanceof Date || Buffer.isBuffer(data)) return data
    if (Array.isArray(data)) {
        let changed = false
        const out = data.map((v) => {
            const next = walk(v, fn, depth + 1)
            if (next !== v) changed = true
            return next
        })
        return changed ? out : data
    }
    let changed = false
    const out = {}
    for (const [k, v] of Object.entries(data)) {
        out[k] = walk(v, fn, depth + 1)
        if (out[k] !== v) changed = true
    }
    return changed ? out : data
}

/** 响应出口：把所有 /uploads/ 相对路径补成完整 URL */
export const absolutize = (data, origin) =>
    origin ? walk(data, (s) => toPublicUrl(s, origin)) : data

/** 请求入口：把前端回填的完整 URL 还原成相对路径 */
export const relativize = (data) => walk(data, toStoragePath)
