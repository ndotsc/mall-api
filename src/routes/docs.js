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
      get: { summary: '我的购物车', responses: { '200': { description: 'items' } } },
      post: { summary: '加入购物车', responses: { '200': { description: 'ok' } } },
    },
    '/cart/{productId}': {
      put: { summary: '改数量', responses: { '200': { description: 'ok' } } },
      delete: { summary: '移除', responses: { '200': { description: 'ok' } } },
    },
    '/addresses': {
      get: { summary: '我的地址列表', responses: { '200': { description: 'list' } } },
      post: { summary: '新增地址', responses: { '200': { description: 'address' } } },
    },
    '/orders': {
      get: { summary: '我的订单列表', responses: { '200': { description: 'list' } } },
      post: { summary: '下单（金额服务端重算）', responses: { '200': { description: 'orderNo' } } },
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
