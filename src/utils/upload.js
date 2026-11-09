import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { AppError } from './AppError.js'

// 与 app.js 的静态目录保持一致：默认 public/uploads，
// 三后端共用一份文件时在 .env 配 UPLOAD_DIR=../uploads（见 backend/README.md）。
// 故意在回调里取值，避免模块加载顺序早于 dotenv 读 .env。
const uploadDir = () => process.env.UPLOAD_DIR || 'public/uploads'
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = uploadDir()
        fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        // 文件名由服务端生成（时间戳+随机），不使用原始文件名，天然防路径穿越
        const ext = path.extname(file.originalname).toLowerCase()
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext)
    },
})

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 单文件上限 2MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase()
        if (!ALLOWED_EXT.includes(ext)) {
            return cb(new AppError('仅支持 jpg / png / gif / webp 图片', 400, 400))
        }
        cb(null, true)
    },
})

export default upload