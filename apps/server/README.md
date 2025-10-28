# API 文档

### 基本信息

- **基本 URL**: `https://rewriting.congrongtech.cn/`
- **Content-Type**: `application/json`
- **编码**: UTF-8

所有接口遵循统一的响应格式：
```json
{
  "code": 0,
  "message": "响应消息",
  "data": {},
  "timestamp": 1672531200000
}
```
- `code`: 状态码，`0` 表示成功，其他表示错误。
- `message`: 响应的描述信息。
- `data`: 响应的具体数据。
- `timestamp`: 服务器响应时的时间戳。

---

### API 详情

### 1. 发送短信验证码

**端点**: `POST /otp`

**描述**: 向用户手机发送一次性短信验证码，可用于注册或登录等后续操作。

**请求体**:
```json
{
  "phone": "+8613800138000",
  "purpose": "signup"
}
```

**参数**:
- `phone` (必需): 用户的手机号码，需符合国际格式（如 `+` 开头）。
- `purpose` (可选): 验证码用途，`signup` 表示注册（默认），`login` 表示登录。

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+8613800138000",
    "purpose": "login"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "验证码发送成功",
  "data": null,
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 请求体或参数错误**:
  ```json
  {
    "code": 400,
    "message": "请求体格式错误，应为 JSON",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "手机号格式不正确",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 409 - 手机号已注册**:
  ```json
  {
    "code": 409,
    "message": "该手机号已注册，请直接登录",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 手机号未注册（登录场景）**:
  ```json
  {
    "code": 404,
    "message": "该手机号尚未注册",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "验证码发送失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 2. 用户注册

**端点**: `POST /user/register`

**描述**: 创建新用户账户，支持邮箱注册和可选的手机号绑定。

**请求体**:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "phone": "+8613800138000",
  "verification_code": "123456",
  "password": "password123",
  "invite_code": "ABC123"
}
```

**参数**:
- `username` (必需): 用户名，3-20个字符，支持字母、数字、下划线和中文字符
- `email` (必需): 邮箱地址，需符合邮箱格式
- `phone` (可选): 手机号码，需符合国际格式（如 `+` 开头）
- `verification_code` (可选): 验证码，4-6位数字。如果提供了手机号则此参数为必需，来自短信验证
- `password` (必需): 密码，6-100个字符
- `invite_code` (可选): 邀请码，6位大写字母和数字组合

**cURL 示例**:
```bash
# 基础注册（不使用手机号和邀请码）
curl -X POST https://rewriting.congrongtech.cn/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "verification_code": "123456",
    "password": "password123"
  }'

# 完整注册（包含手机号和邀请码）
curl -X POST https://rewriting.congrongtech.cn/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "phone": "+8613800138000",
    "verification_code": "123456",
    "password": "password123",
    "invite_code": "ABC123"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "phone": "+8613800138000",
    "invite_code": "XYZ789",
    "role": "user",
    "points_balance": 0,
    "created_at": "2023-12-01T10:00:00.000Z",
    "invited_by": "inviter_username"
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 请求体或参数错误**:
  ```json
  {
    "code": 400,
    "message": "请求体格式错误，应为 JSON",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "用户名至少3个字符",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "邮箱格式不正确",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "提供手机号时必须提供验证码",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 邀请码无效**:
  ```json
  {
    "code": 404,
    "message": "邀请码无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 409 - 资源冲突**:
  ```json
  {
    "code": 409,
    "message": "用户名已存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 409,
    "message": "邮箱已被注册",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 409,
    "message": "手机号已被注册",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "服务器内部错误",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 3. 用户登录

**端点**: `POST /user/login`

**描述**: 用户登录接口，支持用户名密码登录和手机号OTP验证码登录两种方式。

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```
或
```json
{
  "phone": "+8613800138000",
  "verification_code": "123456"
}
```

**参数**:
- **用户名密码登录方式**:
  - `username` (必需): 用户名
  - `password` (必需): 密码
- **手机号OTP登录方式**:
  - `phone` (必需): 手机号码，需符合国际格式
  - `verification_code` (必需): 短信验证码，4-6位数字

**注意**: 两种登录方式只能选择一种，不能同时提供。

**cURL 示例**:
```bash
# 用户名密码登录
curl -X POST https://rewriting.congrongtech.cn/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# 手机号OTP登录
curl -X POST https://rewriting.congrongtech.cn/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+8613800138000",
    "verification_code": "123456"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user": {
      "id": "uuid-string",
      "username": "testuser",
      "email": "test@example.com",
      "phone": "+8613800138000",
      "role": "user",
      "points_balance": 100,
      "invite_code": "XYZ789",
      "created_at": "2023-12-01T10:00:00.000Z"
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_at": 1701470400
    }
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 请求参数错误**:
  ```json
  {
    "code": 400,
    "message": "请提供用户名密码或手机号验证码进行登录",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "只能选择一种登录方式",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "手机号格式不正确",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 401 - 认证失败**:
  ```json
  {
    "code": 401,
    "message": "用户名或密码错误",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "验证码错误或已过期",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "手机号与验证码不匹配",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "手机号未注册",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "服务器内部错误",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 4. 用户退出登录

**端点**: `POST /user/logout`

**描述**: 用户退出登录接口，使当前访问令牌和刷新令牌失效。

**请求头**:
```
Authorization: Bearer <access_token>
refresh_token: <refresh_token>
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`
- `refresh_token` (可选): 刷新令牌，用于撤销令牌以防止后续使用

**cURL 示例**:
```bash
# 基础退出（仅使用access_token）
curl -X POST https://rewriting.congrongtech.cn/user/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 完整退出（同时撤销refresh_token）
curl -X POST https://rewriting.congrongtech.cn/user/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "refresh_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "退出登录成功",
  "data": null,
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 缺少访问令牌**:
  ```json
  {
    "code": 400,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 401 - 访问令牌无效**:
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "服务器内部错误",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 即使access_token已过期或无效，接口仍会返回成功响应
- refresh_token的撤销是可选的，如果撤销失败不会影响退出流程
- 建议客户端在退出后清除本地存储的所有令牌信息

---