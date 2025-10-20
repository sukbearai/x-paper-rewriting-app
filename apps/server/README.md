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

### 1. 用户登录

**端点**: `POST /login`

**描述**: 支持两种登录方式：用户名+密码 或 手机号+验证码。

**请求体 - 用户名密码登录**:
```json
{
  "username": "yourusername",
  "password": "yourpassword"
}
```

**请求体 - 手机号验证码登录**:
```json
{
  "phone": "+8613800138000",
  "otp": "123456"
}
```

**参数**:
- `username` (用户名密码登录必需): 用户名，长度至少 1 位。
- `password` (用户名密码登录必需): 密码，长度至少 1 位。
- `phone` (手机号验证码登录必需): 用户的手机号码，需符合国际格式。
- `otp` (手机号验证码登录必需): 通过短信收到的 4-8 位验证码。

**cURL 示例 - 用户名密码登录**:
```bash
curl -X POST https://rewriting.congrongtech.cn/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "yourusername",
    "password": "yourpassword"
  }'
```

**cURL 示例 - 手机号验证码登录**:
```bash
curl -X POST https://rewriting.congrongtech.cn/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+8613800138000",
    "otp": "123456"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "user": {
      "id": 123,
      "username": "yourusername",
      "email": "user@example.com",
      "phone": "+8613800138000",
      "role": "user",
      "pointsBalance": 1000.00,
      "inviteCode": "ABC123",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "session": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "def50200...",
      "expiresIn": 3600
    }
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
    "message": "请提供用户名密码或手机号验证码进行登录",
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
    "message": "验证码不正确或已过期",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "获取用户信息失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 2. 发送短信验证码

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

### 3. 用户注册

**端点**: `POST /signup`

**描述**: 使用邮箱、密码等信息注册新用户。如果提供了手机号，则必须同时提供通过 `/otp` 接口获取的验证码。

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "newuser",
  "phone": "+8613800138000",
  "otp": "123456",
  "inviteCode": "optional-code"
}
```

**参数**:
- `email` (必需): 用户的邮箱地址。
- `password` (必需): 密码，长度至少 6 位。
- `username` (必需): 用户名，长度至少 2 位。
- `phone` (可选): 用户的手机号码。
- `otp` (如果提供了 `phone` 则必需): 通过短信收到的 4-8 位验证码。
- `inviteCode` (可选): 邀请码。

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "username": "newuser",
    "phone": "+8613800138000",
    "otp": "123456"
  }'
```

**成功响应 (HTTP 201)**:
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "userId": "user-uuid",
    "profileId": 123,
    "inviteCode": "optional-code"
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 参数校验失败**:
  ```json
  {
    "code": 400,
    "message": "邮箱不能为空", // 或其他参数校验错误信息
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "手机号注册需要验证码",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400 - 验证码错误**:
  ```json
  {
    "code": 400,
    "message": "验证码不正确或已过期",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400/500 - 注册失败**:
  ```json
  {
    "code": 400,
    "message": "注册失败", // 或更具体的数据库错误信息
    "data": null,
    "timestamp": 1672531200000
  }
  ```
