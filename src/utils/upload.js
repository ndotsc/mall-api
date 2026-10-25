import multer from 'multer'
import path from 'path'
import fs from 'fs'

const dir = 'public/uploads'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname)
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext)
    },
})

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
})

export default upload