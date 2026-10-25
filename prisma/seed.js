import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 和你 product.js 里的内存数据保持一致，只是换成写库
const products = [
  { name: '降噪蓝牙耳机 Pro', price: 89900, cover: 'https://picsum.photos/seed/p1/400/400', desc: '主动降噪，续航 40 小时' },
  { name: '机械键盘 87 键', price: 45900, cover: 'https://picsum.photos/seed/p2/400/400', desc: '热插拔轴体，全键无冲' },
  { name: 'Iphone 18pro', price: 1099000, cover: 'https://picsum.photos/seed/p3/400/400', desc: '新一代苹果手机' },
  { name: '路由器', price: 30000, cover: 'https://picsum.photos/seed/p4/400/400', desc: 'Wifi6路由器' },
  { name: '矿泉水', price: 1000, cover: 'https://picsum.photos/seed/p5/400/400', desc: '法国原装进口' },
  { name: '手机支架', price: 2000, cover: 'https://picsum.photos/seed/p6/400/400', desc: '可横可竖' },
  { name: '显示器', price: 200000, cover: 'https://picsum.photos/seed/p7/400/400', desc: '27英寸大屏，144Hz高刷' },
  { name: '插线板', price: 4000, cover: 'https://picsum.photos/seed/p8/400/400', desc: '公牛插线板，12个孔位' },
  { name: '卫生纸', price: 3000, cover: 'https://picsum.photos/seed/p9/400/400', desc: '一袋含20个，全独立包装' },
  { name: '冰箱', price: 189900, cover: 'https://picsum.photos/seed/p10/400/400', desc: '三开门超大容量，静音冰箱' },
]

const articles = [
  { title: '品牌故事', cover: 'https://picsum.photos/seed/a1/800/450', summary: '从一间小店开始的十年', content: '<p>品牌故事正文……</p>', status: 1 },
  { title: '2026 年新品发布', cover: 'https://picsum.photos/seed/a2/800/450', summary: '这一年我们做了什么', content: '<p>新品发布正文……</p>', status: 1 },
  { title: '配送与售后说明', cover: 'https://picsum.photos/seed/a3/800/450', summary: '下单前请先看这里', content: '<p>配送说明正文……</p>', status: 1 },
]

async function main() {
  console.log('清空旧数据...')
  await prisma.product.deleteMany()
  await prisma.article.deleteMany()

  await prisma.product.createMany({ data: products })
  await prisma.article.createMany({ data: articles })

  await prisma.category.createMany({
    data: [
      { name: '数码配件', sort: 1 },
      { name: '家居生活', sort: 2 },
      { name: '图书文创', sort: 3 },
    ]
  })
  await prisma.user.create({
    data: { username: 'admin', password: '', role: 2, nickname: '管理员' },
  })

  console.log(`种子完成：${products.length} 个商品 / ${articles.length} 篇文章`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
