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

### 3. 获取用户列表

**端点**: `POST /user`

**描述**: 获取所有用户档案信息（仅用于调试和管理）。

**请求体**: 无需参数

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "获取成功",
  "data": [
    {
      "id": 1,
      "user_id": "uuid-string",
      "username": "testuser",
      "email": "test@example.com",
      "phone": "+8613800138000",
      "role": "user",
      "points_balance": 100,
      "invited_by": null,
      "invite_code": "XYZ789",
      "created_at": "2023-12-01T10:00:00.000Z",
      "updated_at": "2023-12-01T10:00:00.000Z"
    }
  ],
  "timestamp": 1672531200000
}
```

---
