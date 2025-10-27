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
