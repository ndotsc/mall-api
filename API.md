# mall-api 接口文档

> 基础路径：`/api`
> 统一响应：`{ code: 0, message: "ok", data: ... }`；业务错误 `code` 同 HTTP 状态码（如 400/401/404）。
> 鉴权：需要登录的接口在请求头带 `Authorization: Bearer <token>`。
> 说明：金额字段（`price` / `totalAmount`）单位均为**分**，前端展示请 ÷100。

---

## 一、认证 Auth（`/api/auth`）

### 1. 注册 `POST /api/auth/register`
限流：同 IP 15 分钟内最多 10 次。

请求体：
```json
{ "username": "alice", "password": "123456", "nickname": "Alice" }
```
响应（data）：
```json
{ "token": "<JWT>", "user": { "id": 1, "username": "alice", "nickname": "Alice", "role": 1 } }
```

### 2. 账号密码登录 `POST /api/auth/login`
适用端：**H5 / App（非微信）**。限流同上。

请求体：
```json
{ "username": "alice", "password": "123456" }
```
响应同注册（返回 `token` + `user`）。

### 3. 微信登录 `POST /api/auth/wx-login`（新增）
适用端：**微信小程序（mp-weixin）/ App 微信**。前端调用 `uni.login({ provider: 'weixin' })` 拿到 `code` 后传过来；后端用 `code` 换 `openid`，首次登录自动建号，最后签发 JWT。

请求体：
```json
{ "code": "081abc..." }
```
响应（data）：
```json
{ "token": "<JWT>", "user": { "id": 2, "nickname": null, "role": 1, "avatar": null } }
```
> 后端需配置环境变量 `WX_APPID` / `WX_SECRET`（小程序或微信开放平台的应用凭证）。未配置或 `code` 无效会返回明确错误。

### 4. 公众号网页授权登录 `POST /api/auth/wx-oauth`（新增）
适用端：**H5 在微信内打开**。这是「微信一键登录」的后端落地：前端先构造授权链接把用户重定向到微信，微信带着 `code` 跳回前端回调页，前端再把 `code` 传给本接口；后端用 `code` 换 `openid`，首次登录自动建号，最后签发 JWT。

前端构造的授权链接（`scope=snsapi_base` 静默拿 openid，无需用户点同意）：
```
https://open.weixin.qq.com/connect/oauth2/authorize
  ?appid=<公众号AppID>
  &redirect_uri=<encodeURIComponent(前端回调地址)>
  &response_type=code
  &scope=snsapi_base
  &state=<随机串防CSRF>
  &connect_redirect=1#wechat_redirect
```

请求体：
```json
{ "code": "081abc..." }
```
响应同 wx-login（返回 `token` + `user`）。
> 后端需配置环境变量 `WX_OA_APPID` / `WX_OA_SECRET`（公众号凭证，缺省回退到 `WX_APPID` / `WX_SECRET`）。同时需在公众号后台配置「网页授权域名」，且域名已备案 + HTTPS。未配置或 `code` 无效会返回明确错误。
> 若想要昵称/头像，可改用 `scope=snsapi_userinfo` 并在后端用 `access_token` 调 `sns/userinfo`（本项目暂未实现，按需扩展）。

### 5. 获取当前用户 `GET /api/auth/me`
鉴权：是。返回当前 token 对应的用户（不含密码）。

---

## 二、购物车 Cart（`/api/cart`，鉴权：是）

| 方法 | 路径 | 入参 | 说明 |
|---|---|---|---|
| GET | `/api/cart` | — | 列表，每项附带 `product` 快照 `{id,name,price,cover}`（商品已删除则为 `null`） |
| POST | `/api/cart` | `{ productId:int, number?:int(≤99) }` | 加入购物车；同一用户+同一商品**数量累加** |
| PUT | `/api/cart/:id` | `{ number:int(≤99) }` | 修改数量（直接设为传入值） |
| DELETE | `/api/cart/:id` | — | 删除一项 |
| DELETE | `/api/cart` | — | 清空当前用户购物车 |

GET 列表返回示例：
```json
[
  {
    "id": 2, "userId": 1, "productId": 11, "number": 5,
    "product": { "id": 11, "name": "降噪蓝牙耳机 Pro", "price": 89900, "cover": "https://..." }
  }
]
```

---

## 三、收货地址 Address（`/api/addresses`，鉴权：是）

| 方法 | 路径 | 入参 | 说明 |
|---|---|---|---|
| GET | `/api/addresses` | — | 列表，**默认地址排第一** |
| POST | `/api/addresses` | `{ name, phone, detail, isDefault?:bool }` | 新增；若 `isDefault=true` 会自动取消该用户其它默认地址（事务保证唯一） |
| PUT | `/api/addresses/:id` | `{ name?, phone?, detail?, isDefault? }` | 修改；`isDefault=true` 同样保证唯一 |
| DELETE | `/api/addresses/:id` | — | 删除；若删掉的是默认地址，自动把剩余第一条提升为默认 |

字段校验：
- `phone`：必须为大陆 11 位手机号 `/^1[3-9]\d{9}$/`
- `name`：1–20 字；`detail`：1–200 字

新增返回示例：
```json
{ "id": 1, "userId": 1, "name": "张三", "phone": "13800000001", "detail": "软件园", "isDefault": true }
```

---

## 四、订单 Order（`/api/orders`，鉴权：是）

### 1. 下单 `POST /api/orders`
请求体：
```json
{
  "items": [{ "productId": 11, "number": 2 }],
  "info": { "name": "张三", "phone": "13800000001", "address": "软件园" },
  "payType": "wechat",
  "remark": "尽快发货"
}
```
> 服务端按库内价重算金额，不信任前端传价。返回 `{ orderNo }`。

### 2. 订单详情 `GET /api/orders/:orderNo`
返回订单及其 `items`（含下单时快照的商品名/单价/封面）。普通用户只能查自己的订单；管理员（`role=2`）可查任意。

---

## 五、其它（略）
商品 `/api/products`、分类 `/api/categories`、文章 `/api/articles`、文件上传 `/api/upload` 等接口遵循同样的约定（统一响应、`authRequired`+`adminRequired` 组合鉴权），此处不再赘述。
