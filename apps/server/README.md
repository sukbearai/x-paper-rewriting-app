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

### 4. 查询用户列表

**端点**: `GET /user/list`

**描述**: 查询用户列表，需要登录并具备 `admin` 或 `agent` 角色。

**请求头**:
```
Authorization: Bearer <access_token>
```

**权限说明**:
- 管理员（`admin`）可以查看所有用户。
- 代理（`agent`）仅能查看自己邀请的下级用户。

**cURL 示例**:
```bash
# 管理员查询所有用户
curl -X GET https://rewriting.congrongtech.cn/user/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 代理查询下级用户
curl -X GET https://rewriting.congrongtech.cn/user/list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "获取用户列表成功",
  "data": {
    "users": [
      {
        "id": 1,
        "user_id": "uuid-string",
        "username": "testuser",
        "email": "test@example.com",
        "phone": "+8613800138000",
        "role": "user",
        "points_balance": 120,
        "invite_code": "INV001",
        "invited_by": null,
        "invited_by_username": null,
        "created_at": "2023-12-01T10:00:00.000Z"
      }
    ],
    "total": 1,
    "scope": "all"
  },
  "timestamp": 1672531200000
}
```

**响应字段说明**:
- `users`: 用户数组，字段包含 `id`、`user_id`、`username`、`email`、`phone`、`role`、`points_balance`、`invite_code`、`invited_by`、`created_at`。
  - 每个用户对象新增字段 `invited_by_username`，用于展示邀请人的用户名（若无邀请人则为 `null`）。
- `total`: 返回的用户数量。
- `scope`: 查询范围，管理员为 `all`，代理为 `downline`。

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 403 - 权限不足**:
  ```json
  {
    "code": 403,
    "message": "无权访问",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "获取用户列表失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 5. 管理员修改用户角色

**端点**: `POST /user/update-role`

**描述**: 管理员修改任意用户的角色，支持在 `admin`、`agent`、`user` 之间切换。

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "target_user_id": "uuid-string",
  "role": "agent"
}
```

**参数**:
- `Authorization` (必需): 访问令牌，仅管理员角色可调用。
- `target_user_id` (必需): 目标用户的 Supabase Auth `user_id`，UUID 格式。
- `role` (必需): 目标角色，允许值为 `admin`、`agent`、`user`。

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/user/update-role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "target_user_id": "8f8b2c9e-5a4f-4a38-b9c0-77cbd9c0bb01",
    "role": "agent"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "角色更新成功",
  "data": {
    "id": 12,
    "user_id": "8f8b2c9e-5a4f-4a38-b9c0-77cbd9c0bb01",
    "username": "targetuser",
    "email": "target@example.com",
    "phone": "+8613800138001",
    "role": "agent",
    "previous_role": "user",
    "points_balance": 120,
    "invite_code": "INV123",
    "invited_by": null,
    "created_at": "2023-12-01T10:00:00.000Z"
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
    "message": "用户ID格式不正确",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "参数校验失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 403 - 权限不足**:
  ```json
  {
    "code": 403,
    "message": "仅管理员可修改用户角色",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "目标用户不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "更新用户角色失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 当目标用户当前角色与目标角色一致时，接口返回成功并提示角色已是最新状态。
- 成功更新后会同步返回最新的用户档案信息和 `previous_role` 字段，方便前端刷新展示。

---

### 6. 用户退出登录

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

### 7. 用户修改密码

**端点**: `POST /user/change-password`

**描述**: 用户修改密码接口，需要验证当前密码并设置新密码，修改成功后会退出所有会话。

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "current_password": "oldpassword123",
  "new_password": "newpassword456"
}
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`
- `current_password` (必需): 当前密码，用于验证身份
- `new_password` (必需): 新密码，6-100个字符

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/user/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "current_password": "oldpassword123",
    "new_password": "newpassword456"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "密码修改成功，请重新登录",
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
- **HTTP 400 - 请求参数错误**:
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
    "message": "新密码至少6个字符",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "新密码不能与当前密码相同",
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
- **HTTP 401 - 当前密码错误**:
  ```json
  {
    "code": 401,
    "message": "当前密码错误",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "用户档案不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "密码更新失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 修改密码成功后会自动退出所有会话，用户需要使用新密码重新登录
- 新密码不能与当前密码相同，必须符合密码格式要求
- 需要提供有效的访问令牌才能调用此接口
- 建议客户端在收到成功响应后清除本地存储的登录状态

---

### 8. 提交降重或降AI率任务

**端点**: `POST /ai/reduce-task`

**描述**: 提交降重或降AI率任务，支持知网和维普平台。需要用户登录认证，按文本长度动态计算积分消耗，并会基于平台和任务类型自动切换上游 AI 服务。

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "text": "待处理的文本内容（最多3000字）",
  "platform": "zhiwang",
  "type": "reduce-plagiarism"
}
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取
- `text` (必需): 待处理的文本内容，最多3000字
- `platform` (必需): 平台选择，支持 `zhiwang`（知网）和 `weipu`（维普）
- `type` (必需): 处理类型，支持 `reduce-plagiarism`（降重）和 `reduce-ai-rate`（降AI率）

**服务路由策略**:

| platform | type | `service` 字段 | REDUCEAI `toolName` / CHEEYUAN `product_type` |
| --- | --- | --- | --- |
| `zhiwang` | `reduce-plagiarism` | `reduceai` | `onlyjc`
| `zhiwang` | `reduce-ai-rate` | `cheeyuan` | `78` (固定 product_type)
| `weipu` | `reduce-plagiarism` | `reduceai` | `onlyjc`
| `weipu` | `reduce-ai-rate` | `reduceai` | `onlyai`

> 客户端无需关心上游具体实现，按平台+类型组合传参即可。

**积分说明**:
- 每1000字消耗3积分，按实际字数比例计算
- 积分消耗计算公式：`(文本字数 ÷ 1000) × 3`
- 例如：800字文本消耗2.4积分，1200字文本消耗3.6积分
- 积分结果保留3位小数，截取而不四舍五入（避免JavaScript浮点数精度问题）
- 积分不足时无法提交任务
- 任务提交成功后立即扣除积分
- 如果AI服务返回错误，已扣除的积分对应的交易记录会被标记为失败(is_successful=false)
- 失败任务的积分不会自动退还，需要管理员手动处理

**cURL 示例**:
```bash
# 知网降重
curl -X POST https://rewriting.congrongtech.cn/ai/reduce-task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "text": "需要降重的文本内容",
    "platform": "zhiwang",
    "type": "reduce-plagiarism"
  }'

# 知网降AI率
curl -X POST https://rewriting.congrongtech.cn/ai/reduce-task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "text": "需要降AI率的文本内容",
    "platform": "zhiwang",
    "type": "reduce-ai-rate"
  }'

# 维普降重
curl -X POST https://rewriting.congrongtech.cn/ai/reduce-task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "text": "需要降重的文本内容",
    "platform": "weipu",
    "type": "reduce-plagiarism"
  }'

# 维普降AI率
curl -X POST https://rewriting.congrongtech.cn/ai/reduce-task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "text": "需要降AI率的文本内容",
    "platform": "weipu",
    "type": "reduce-ai-rate"
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "任务提交成功",
  "data": {
    "taskId": "onlyjc_98631379_1758017276712",
    "service": "reduceai",
    "newBalance": 462,
    "cost": 3.6
  },
  "timestamp": 1672531200000
}
```

**说明**:
- 只有当上游服务确认接单后才会扣除积分，并在 `points_transactions` 表新增一条 `spend` 记录
- 积分交易会记录人类可读的任务标签（如“降重（知网版）”），方便运营侧排查
- 若启用了 R2（生产环境默认开启），系统会把原始文本上传为 `user_input_file_url`，上游返回文本上传为 `ai_response_file_url`
- 上游若返回错误或后续查询失败，会把对应交易标记为 `is_successful=false`，可配合 `POST /points/refund` 做人工返还

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400 - 请求参数错误**:
  ```json
  {
    "code": 400,
    "message": "缺少文本内容参数",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "文本内容不能超过3000字",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "平台参数错误，必须为zhiwang或weipu",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400 - 积分不足**:
  ```json
  {
    "code": 400,
    "message": "积分不足，当前积分：2，需要积分：3.6",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "CHEEYUAN任务提交失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 9. 查询任务结果

**端点**: `POST /ai/result`

**描述**: 查询降重或降AI率任务的处理结果。需要用户登录认证，会根据 `service` 字段自动调用 REDUCEAI 或 CHEEYUAN，并把最新状态返回给客户端。

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "taskId": "onlyjc_98631379_1758017276712",
  "service": "reduceai"
}
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取
- `taskId` (必需): 任务ID，从提交任务接口返回
- `service` (必需): 服务提供商，支持 `reduceai` 和 `cheeyuan`

**cURL 示例**:
```bash
# 查询REDUCEAI服务任务结果
curl -X POST https://rewriting.congrongtech.cn/ai/result \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "taskId": "onlyjc_98631379_1758017276712",
    "service": "reduceai"
  }'

# 查询CHEEYUAN服务任务结果
curl -X POST https://rewriting.congrongtech.cn/ai/result \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "taskId": "123456",
    "service": "cheeyuan"
  }'
```

**成功响应 (HTTP 200)**:

REDUCEAI服务处理中响应（包括上游短暂不可用时返回的占位结果）:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "processing",
    "progress": 39,
    "result": null,
    "queuePosition": 0,
    "cost": 5
  },
  "timestamp": 1672531200000
}
```

REDUCEAI服务完成响应（若 `result` 是字符串会触发 R2 输出快照上传）:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "completed",
    "progress": 100,
    "result": "处理后的文本内容",
    "cost": 5
  },
  "timestamp": 1672531200000
}
```

CHEEYUAN服务处理中响应:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "processing",
    "progress": 0,
    "result": null,
    "created_at": "2025-11-03 14:04:04",
    "updated_at": "2025-11-03 14:04:04"
  },
  "timestamp": 1672531200000
}
```

REDUCEAI服务失败响应:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "failed",
    "progress": 0,
    "result": null,
    "cost": 5
  },
  "timestamp": 1672531200000
}
```

CHEEYUAN服务完成响应:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "completed",
    "progress": 100,
    "result": "处理后的文本内容",
    "created_at": "2025-11-03 14:04:04",
    "updated_at": "2025-11-03 14:04:16"
  },
  "timestamp": 1672531200000
}
```

CHEEYUAN服务失败响应:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "status": "failed",
    "progress": 0,
    "result": null,
    "created_at": "2025-11-03 14:04:04",
    "updated_at": "2025-11-03 14:04:16"
  },
  "timestamp": 1672531200000
}
```

**说明**:
- REDUCEAI 查询若出现 HTTP 错误，会返回 `status="processing"` 的占位数据，前端可稍后重试
- 当任务状态为 `failed` 时，系统会自动把对应的积分交易更新为 `is_successful=false`
- 拿到完整结果文本时，会把内容上传到 R2 并写入 `points_transactions.ai_response_file_url`
- CHEEYUAN 通过 `deal_status` 来区分状态：`1` 成功、`2` 失败、其他为处理中

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400 - 请求参数错误**:
  ```json
  {
    "code": 400,
    "message": "缺少任务ID参数",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "服务参数错误，必须为reduceai或cheeyuan",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "CHEEYUAN结果查询失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

---

### 10. 查询用户积分

**端点**: `POST /ai/points`

**描述**: 查询当前用户的积分余额和积分计费规则。需要用户登录认证，返回值与扣费逻辑共用同一套配置，适合在前端实时展示。

**请求头**:
```
Authorization: Bearer <access_token>
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/ai/points \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "points_balance": 450,
    "task_cost": 3,
    "cost_per_1000_chars": 3
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
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
- `points_balance`: 当前积分余额，服务端统一截取三位小数
- `task_cost` 与 `cost_per_1000_chars` 均来源于后端常量 `POINTS_PER_1000_CHARS`（目前为 3）
- 前端可用 `points_balance` 与 `task_cost` 计算某段文字的预计消耗（同 `calculateTaskCost` 逻辑）
- 若任务失败积分不会自动返还，但会把交易标记为 `is_successful=false`，可配合返还接口处理

---

### 11. 查询积分余额

**端点**: `GET /points/balance`

**描述**: 查询当前用户的积分余额。需要用户登录认证。

**请求头**:
```
Authorization: Bearer <access_token>
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取

**cURL 示例**:
```bash
curl -X GET https://rewriting.congrongtech.cn/points/balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "查询积分余额成功",
  "data": {
    "points_balance": 1500
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "用户信息不存在",
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

### 12. 查询充值记录

**端点**: `GET /points/recharges`

**描述**: 查询积分充值记录。仅管理员和代理可用，管理员返回所有用户的充值记录，代理仅返回其邀请的下级用户充值记录。

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取
- `page` (可选): 页码，默认为1，必须大于0
- `limit` (可选): 每页数量，默认为20，最大100，必须大于0

**cURL 示例**:
```bash
# 管理员查询全部充值记录
curl -X GET "https://rewriting.congrongtech.cn/points/recharges?page=1&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 代理查询下级充值记录
curl -X GET "https://rewriting.congrongtech.cn/points/recharges?page=1&limit=20" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "查询充值记录成功",
  "data": {
    "records": [
      {
        "id": 101,
        "profile_id": 456,
        "amount": 100,
        "balance_after": 450,
        "description": "管理员充值",
        "reference_id": "admin_topup_202401",
        "is_successful": true,
        "created_at": "2024-01-18T09:00:00.000Z",
        "profile": {
          "id": 456,
          "user_id": "8f8b2c9e-5a4f-4a38-b9c0-77cbd9c0bb01",
          "username": "targetuser",
          "email": "target@example.com",
          "phone": "+8613800138001",
          "role": "agent",
          "invited_by": 123,
          "invited_by_username": "admin"
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 5,
      "total_pages": 1,
      "has_next_page": false,
      "has_prev_page": false
    },
    "scope": "all"
  },
  "timestamp": 1672531200000
}
```

**响应字段说明**:
- `records`: 充值记录数组
  - `id`: 充值记录ID
  - `profile_id`: 用户档案ID
  - `amount`: 充值积分变动（整数或三位小数）
  - `balance_after`: 充值后的积分余额（保留三位小数，截取而非四舍五入）
  - `description`: 充值说明或备注
  - `reference_id`: 关联参考ID（如订单号或返还标识）
  - `is_successful`: 是否充值成功
  - `created_at`: 充值时间
  - `profile`: 充值用户档案信息（包含 `user_id`、`username`、`email`、`phone`、`role`、`invited_by`、`invited_by_username`）
- `pagination`: 分页信息，同积分交易记录接口
- `scope`: 查询范围，管理员为 `all`，代理为 `downline`

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 403 - 权限不足**:
  ```json
  {
    "code": 403,
    "message": "无权访问充值记录",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "用户信息不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "查询充值记录失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 仅管理员 (`admin`) 和代理 (`agent`) 可访问该接口
- 管理员返回所有用户的充值记录；代理仅返回其邀请的下级用户充值记录
- 返回的 `profile` 字段可用于在前端展示充值用户及其邀请链信息

---

### 13. 查询积分交易记录

**端点**: `GET /points/transactions`

**描述**: 查询当前用户的积分交易记录，支持分页和筛选。需要用户登录认证。

**请求头**:
```
Authorization: Bearer <access_token>
```

**查询参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`，通过用户登录接口获取
- `page` (可选): 页码，默认为1，必须大于0
- `limit` (可选): 每页数量，默认为20，最大100，必须大于0
- `transaction_type` (可选): 交易类型筛选，支持 `recharge`（充值）、`spend`（消费）、`transfer`（转账）
- `start_date` (可选): 开始日期，ISO格式时间戳，如 `2023-12-01T00:00:00.000Z`
- `end_date` (可选): 结束日期，ISO格式时间戳，如 `2023-12-31T23:59:59.999Z`

**cURL 示例**:
```bash
# 基础查询
curl -X GET "https://rewriting.congrongtech.cn/points/transactions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 分页查询
curl -X GET "https://rewriting.congrongtech.cn/points/transactions?page=2&limit=10" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 按交易类型筛选
curl -X GET "https://rewriting.congrongtech.cn/points/transactions?transaction_type=spend" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 按时间范围筛选
curl -X GET "https://rewriting.congrongtech.cn/points/transactions?start_date=2023-12-01T00:00:00.000Z&end_date=2023-12-31T23:59:59.999Z" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 复合查询
curl -X GET "https://rewriting.congrongtech.cn/points/transactions?page=1&limit=20&transaction_type=spend&start_date=2023-12-01T00:00:00.000Z" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "查询积分交易记录成功",
  "data": {
    "transactions": [
      {
        "id": 1,
        "profile_id": 123,
        "transaction_type": "spend",
        "amount": -3.6,
        "balance_after": 146.4,
        "description": "AI降重任务消费",
        "reference_id": "onlyjc_98631379_1758017276712",
        "is_successful": true,
        "created_at": "2023-12-01T10:30:00.000Z"
      },
      {
        "id": 2,
        "profile_id": 123,
        "transaction_type": "recharge",
        "amount": 100,
        "balance_after": 150,
        "description": "管理员充值",
        "reference_id": "admin_topup_001",
        "is_successful": true,
        "created_at": "2023-12-01T09:00:00.000Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 25,
      "total_pages": 2,
      "has_next_page": true,
      "has_prev_page": false
    }
  },
  "timestamp": 1672531200000
}
```

**响应字段说明**:
- `transactions`: 交易记录数组
  - `id`: 交易记录ID
  - `profile_id`: 用户档案ID
  - `transaction_type`: 交易类型（recharge/spend/transfer）
  - `amount`: 交易金额（正数为收入，负数为支出）
  - `balance_after`: 交易后的余额
  - `description`: 交易描述
  - `reference_id`: 关联的参考ID（如任务ID）
  - `user_input_file_url`: AI 任务原始输入文本的快照链接（仅降重/降AI率任务会写入，可能为 `null`）
  - `ai_response_file_url`: AI 任务返回文本的快照链接（仅当上游返回完整文本时写入，可能为 `null`）
  - `is_successful`: 交易是否成功
  - `created_at`: 创建时间
- `pagination`: 分页信息
  - `current_page`: 当前页码
  - `per_page`: 每页数量
  - `total`: 总记录数
  - `total_pages`: 总页数
  - `has_next_page`: 是否有下一页
  - `has_prev_page`: 是否有上一页

**错误响应**:
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 400 - 请求参数错误**:
  ```json
  {
    "code": 400,
    "message": "页码必须大于0",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "每页数量不能超过100",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "开始日期格式不正确",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户不存在**:
  ```json
  {
    "code": 404,
    "message": "用户信息不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "查询交易记录总数失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 500,
    "message": "查询交易记录失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 用户只能查询自己的积分交易记录
- 交易记录按创建时间倒序排列（最新的在前）
- 支持按交易类型和时间范围进行筛选
- 分页查询可以提高大数据量时的查询性能
- 交易金额正数表示收入，负数表示支出
- 当交易关联 AI 任务且启用了 R2 快照上传时，会返回 `user_input_file_url` 与 `ai_response_file_url`，可用于在运营或客服后台查看原始/处理文本

---

### 14. 积分返还申请

**端点**: `POST /points/refund`

**描述**: 针对失败的积分消费记录申请返还积分。需要用户登录认证。

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求体**:
```json
{
  "transaction_id": 123
}
```

**参数**:
- `Authorization` (必需): 访问令牌，格式为 `Bearer <token>`
- `transaction_id` (必需): 需要返还的积分交易ID，必须为当前用户的消费记录，且状态为失败

**cURL 示例**:
```bash
curl -X POST https://rewriting.congrongtech.cn/points/refund \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "transaction_id": 123
  }'
```

**成功响应 (HTTP 200)**:
```json
{
  "code": 0,
  "message": "积分返还成功",
  "data": {
    "success": true,
    "points_balance": 456.4
  },
  "timestamp": 1672531200000
}
```

**错误响应**:
- **HTTP 400 - 请求参数错误**:
  ```json
  {
    "code": 400,
    "message": "交易ID必须为整数",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "交易ID必须大于0",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "仅消费记录支持返还",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "成功交易无需返还",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "无效的交易金额，无法返还",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 400,
    "message": "该交易已返还积分，请勿重复操作",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 401 - 未授权访问**:
  ```json
  {
    "code": 401,
    "message": "缺少访问令牌",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 401,
    "message": "访问令牌无效",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 404 - 用户或交易不存在**:
  ```json
  {
    "code": 404,
    "message": "用户信息不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 404,
    "message": "交易记录不存在",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
- **HTTP 500 - 服务器内部错误**:
  ```json
  {
    "code": 500,
    "message": "返还状态查询失败，请稍后再试",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 500,
    "message": "更新积分余额失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```
  ```json
  {
    "code": 500,
    "message": "记录返还交易失败",
    "data": null,
    "timestamp": 1672531200000
  }
  ```

**说明**:
- 仅失败的积分消费记录（`transaction_type` 为 `spend` 且 `is_successful=false`）支持返还
- 每笔返还都会新增一条积分充值交易，`reference_id` 为 `refund:<原交易ID>`
- 返还成功后会同步更新用户积分余额，余额按三位小数截断
- 若返还流程执行异常，系统会尝试回滚用户积分余额

---
