# mall-api 接口文档（精简版）

> 本文件是 OpenAPI（`GET /api/docs`，机器可读版 `GET /api/docs/openapi.json`）的人读精简版，**两者端点保持一致**。
> 基础路径：`/api`
> 统一响应：`{ code: 0, message: "ok", data: ... }`；业务错误 `code` 同 HTTP 状态码（400/401/403/404…）。
> 鉴权：需登录的接口在请求头带 `Authorization: Bearer <token>`。标注「公开」的无需鉴权。
> 金额：所有 `price` / `totalAmount` 等金额字段单位均为**分**，前端展示请 ÷100。

---

## 一、健康检查
- `GET /api/health`（公开）服务存活探测，运维/前端定时调用。

## 二、认证 Auth `/api/auth`

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /auth/register | 公开 | 注册，自动建号 `role=1`；限流同 IP 15 分钟 10 次 |
| POST | /auth/login | 公开 | 账号密码登录（H5 / App 非微信端） |
| POST | /auth/wx-login | 公开 | 微信登录（小程序 / App 微信），body `{ "code": "..." }` |
| POST | /auth/wx-oauth | 公开 | 公众号网页授权登录（H5 微信内），body `{ "code": "..." }` |
| GET | /auth/me | Bearer | 获取当前用户 |
| POST | /auth/logout | Bearer | 注销，拉黑当前 token 的 `jti` 立即失效 |

> 微信类接口需在 `.env` 配置 `WX_APPID`/`WX_SECRET`（公众号 `WX_OA_APPID`/`WX_OA_SECRET`，缺省回退小程序凭证）；未配置或 `code` 无效返回明确错误。

## 三、商品 Product `/api/products`

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /products | 公开 | 列表，支持 `page` / `pageSize`(≤50) / `keyword` 分页与搜索，默认按创建时间倒序 |
| POST | /products | 管理员 | 新建商品 |
| GET | /products/{id} | 公开 | 商品详情 |
| PUT | /products/{id} | 管理员 | 更新商品 |
| DELETE | /products/{id} | 管理员 | 软删除（置 `deletedAt`，非物理删除） |

## 四、购物车 Cart `/api/cart`（Bearer）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /cart | 我的购物车，每项带 `product` 快照 |
| POST | /cart | 加入，body `{ "productId": int, "number"?: int(≤99) }`，同一商品数量累加 |
| PUT | /cart/{id} | 改数量（**id 为购物车项 id，非商品 id**），body `{ "number": int(≤99) }` |
| DELETE | /cart/{id} | 移除一项 |
| DELETE | /cart | 清空我的购物车，返回 `{ "count": int }` |

## 五、收货地址 Address `/api/addresses`（Bearer）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /addresses | 我的地址列表，默认地址排第一 |
| POST | /addresses | 新增，body `{ "name", "phone", "detail", "isDefault"?: bool }`；`isDefault=true` 自动取消该用户其它默认地址（事务保证唯一） |
| PUT | /addresses/{id} | 修改，body 同新增（各字段均可选）；`isDefault=true` 自动取消该用户其它默认地址（排除自身，事务保证唯一） |
| DELETE | /addresses/{id} | 删除；若删的是默认地址，自动把剩余第一条提升为默认 |

> 字段校验：`phone` 须大陆 11 位 `/^1[3-9]\d{9}$/`；`name` 1–20 字，`detail` 1–200 字。

## 六、订单 Order `/api/orders`（Bearer）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /orders | 我的订单列表（管理员可查全部），支持 `status` 过滤与分页 |
| POST | /orders | 下单，body `{ "items":[{"productId":int,"number":int}], "info":{"name","phone","address"}, "payType":"wechat", "remark"? }`；**服务端按库内价重算金额**，不信任前端传价 |
| GET | /orders/{orderNo} | 订单详情（含 items） |
| PATCH | /orders/{orderNo}/status | 改状态，body `{ "status": int }`；状态枚举：**1 待付款 / 2 待发货 / 3 待收货 / 4 待评价 / 5 已完成**（演示用，未做流转校验） |

---

### 说明
- 分类 `/categories`、文章 `/articles`、文件上传 `/upload` 等同遵循上述约定（统一响应 + `authRequired`/`adminRequired` 组合鉴权）；本期 OpenAPI 文档暂未展开这三类，需要时再补。
- 上方所有端点已与 `GET /api/docs`（OpenAPI）逐条对齐，两份文档保持一致。
