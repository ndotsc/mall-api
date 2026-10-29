import { Router } from 'express'

// OpenAPI 接口文档：动态构建一份 OpenAPI 3.0 描述，并提供一个 Swagger UI 查看页。
// 访问：
//   GET /api/docs            -> Swagger UI 网页
//   GET /api/docs/openapi.json -> 原始 OpenAPI JSON（可被 CI / 网关 / 代码生成消费）
// 与 API.md 二选一即可，这里以机器可读 + 可视化为主，API.md 保留作人读补充。
const router = Router()

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'mall-api 接口文档',
    version: '1.0.0',
    description:
      '小型商城后端：商品 / 文章 / 分类 / 订单 / 鉴权 / 上传。金额统一以「分」存储（price 单位分）。',
  },
  servers: [
    { url: process.env.PUBLIC_BASE_URL || 'http://localhost:3000/api', description: '默认 / 本地' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'integer' },
          message: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: '健康检查',
        security: [],
        responses: { '200': { description: '服务存活' } },
      },
    },
    '/auth/register': {
      post: {
        summary: '注册（自动建号，role=1）',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: '返回 token + user' }, '400': { description: '参数错误' } },
      },
    },
    '/auth/login': {
      post: {
        summary: '账号密码登录',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } } },
            },
          },
        },
        responses: { '200': { description: '返回 token + user' }, '401': { description: '账号或密码错误' } },
      },
    },
    '/auth/me': {
      get: { summary: '获取当前用户信息', responses: { '200': { description: 'user' }, '401': { description: '未登录' } } },
    },
    '/auth/logout': {
      post: { summary: '注销（拉黑当前 token）', responses: { '200': { description: '成功' } } },
    },
    '/auth/wx-login': {
      post: {
        summary: '微信登录（小程序 / App 微信）',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string' } } } } },
        },
        responses: { '200': { description: '返回 token + user' } },
      },
    },
    '/auth/wx-oauth': {
      post: {
        summary: '公众号网页授权登录（H5 微信一键登录）',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { code: { type: 'string' } } } } },
        },
        responses: { '200': { description: '返回 token + user' } },
      },
    },
    '/products': {
      get: {
        summary: '商品列表（公开，支持分页 / 关键词）',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', maximum: 50 } },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ list, total, page, pageSize }' } },
      },
      post: { summary: '新建商品（需管理员）', responses: { '200': { description: 'product' }, '403': { description: '无权限' } } },
    },
    '/products/{id}': {
      get: { summary: '商品详情（公开）', security: [], responses: { '200': { description: 'product' }, '404': { description: '不存在' } } },
      put: { summary: '更新商品（需管理员）', responses: { '200': { description: 'product' } } },
      delete: { summary: '删除商品（软删除，需管理员）', responses: { '200': { description: '已删除' } } },
    },
    '/cart': {
      get: { summary: '我的购物车', responses: { '200': { description: 'items（含商品快照）' } } },
      post: {
        summary: '加入购物车（同商品累加数量）',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { productId: { type: 'integer' }, number: { type: 'integer' } } } } },
        },
        responses: { '200': { description: 'cart item' }, '400': { description: '商品不存在或已下架' } },
      },
      delete: { summary: '清空购物车', responses: { '200': { description: '{ count }' } } },
    },
    '/cart/{id}': {
      put: { summary: '改数量（直接设为传入值）', responses: { '200': { description: 'cart item' }, '404': { description: '购物车项不存在' } } },
      delete: { summary: '移除某一项', responses: { '200': { description: '{ id }' }, '404': { description: '购物车项不存在' } } },
    },
    '/addresses': {
      get: { summary: '我的地址列表（默认地址排最前）', responses: { '200': { description: 'list' } } },
      post: {
        summary: '新增地址（设默认时自动取消其它默认）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'phone', 'detail'],
                properties: { name: { type: 'string' }, phone: { type: 'string' }, detail: { type: 'string' }, isDefault: { type: 'boolean' } },
              },
            },
          },
        },
        responses: { '200': { description: 'address' } },
      },
    },
    '/addresses/{id}': {
      put: {
        summary: '修改地址（设默认时自动取消其它默认）',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, detail: { type: 'string' }, isDefault: { type: 'boolean' } } } } },
        },
        responses: { '200': { description: 'address' }, '404': { description: '地址不存在' } },
      },
      delete: {
        summary: '删除地址（删默认则自动提升第一条为默认）',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '{ id }' }, '404': { description: '地址不存在' } },
      },
    },
    '/orders': {
      get: { summary: '我的订单列表（支持 status 过滤 + 分页）', responses: { '200': { description: '{ list, total, page, pageSize }' } } },
      post: {
        summary: '下单（金额服务端重算）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['items', 'info'],
                properties: {
                  items: { type: 'array', items: { type: 'object', properties: { productId: { type: 'integer' }, number: { type: 'integer' } } } },
                  info: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' } } },
                  payType: { type: 'string', description: '默认 wechat' },
                  remark: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: '{ orderNo }' }, '400': { description: '商品不存在或已下架' } },
      },
    },
    '/orders/{orderNo}': {
      get: {
        summary: '订单详情',
        parameters: [{ name: 'orderNo', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'order（含 items）' }, '404': { description: '订单不存在' } },
      },
    },
    '/orders/{orderNo}/status': {
      patch: {
        summary: '修改订单状态（status: 1待付款 2待发货 3待收货 4待评价 5已完成）',
        parameters: [{ name: 'orderNo', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'integer', enum: [1, 2, 3, 4, 5] } } } } },
        },
        responses: { '200': { description: 'order' }, '404': { description: '订单不存在' } },
      },
    },
    '/categories': {
      get: { summary: '分类列表（公开，全量返回）', security: [], responses: { '200': { description: 'list' } } },
    },
    '/articles': {
      get: {
        summary: '文章列表（公开，支持分页 + keyword 搜索）',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', maximum: 50 } },
          { name: 'keyword', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: '{ list, total, page, pageSize }' } },
      },
      post: {
        summary: '新建文章（需管理员）',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'cover', 'summary', 'content'],
                properties: {
                  title: { type: 'string' },
                  cover: { type: 'string', description: '封面图 URL' },
                  summary: { type: 'string' },
                  content: { type: 'string' },
                  status: { type: 'integer', description: '可选，默认 1' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'article' }, '403': { description: '无权限' } },
      },
    },
    '/articles/{id}': {
      get: {
        summary: '文章详情（公开）',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'article' }, '404': { description: '文章不存在' } },
      },
      put: {
        summary: '更新文章（需管理员，字段可选）',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, cover: { type: 'string' }, summary: { type: 'string' }, content: { type: 'string' }, status: { type: 'integer' } } } } },
        },
        responses: { '200': { description: 'article' }, '404': { description: '文章不存在' } },
      },
      delete: {
        summary: '删除文章（需管理员）',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '{ id }' }, '404': { description: '文章不存在' } },
      },
    },
    '/upload': {
      post: {
        summary: '上传图片（multipart/form-data，字段名 file）',
        security: [],
        requestBody: {
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } },
        },
        responses: {
          '200': { description: '{ url: "/uploads/文件名" }' },
          '400': { description: '未收到文件 / 仅支持 jpg png gif webp / 超出 2MB' },
        },
      },
    },
  },
}

router.get('/openapi.json', (_req, res) => res.json(spec))

router.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>mall-api 接口文档</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: './openapi.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
      });
    };
  </script>
</body>
</html>`)
})

export default router
