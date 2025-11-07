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

### 5. 用户修改密码

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

### 6. 提交降重或降AI率任务

**端点**: `POST /ai/reduce-task`

**描述**: 提交降重或降AI率任务，支持知网和维普平台。需要用户登录认证，按文本长度动态计算积分消耗。

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

**积分说明**:
- 每1000字消耗3积分，按实际字数比例计算
- 积分消耗计算公式：`(文本字数 ÷ 1000) × 3`
- 例如：800字文本消耗2.4积分，1200字文本消耗3.6积分
- 积分结果保留3位小数，截取而不四舍五入（避免JavaScript浮点数精度问题）
- 积分不足时无法提交任务
- 任务提交成功后立即扣除积分

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

### 7. 查询任务结果

**端点**: `POST /ai/result`

**描述**: 查询降重或降AI率任务的处理结果。需要用户登录认证。

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

REDUCEAI服务处理中响应:
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

REDUCEAI服务完成响应:
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

### 8. 查询用户积分

**端点**: `POST /ai/points`

**描述**: 查询当前用户的积分余额和积分计费规则。需要用户登录认证。

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
- `points_balance`: 用户当前积分余额
- `task_cost`: 每1000字消耗的积分数（固定3积分）
- `cost_per_1000_chars`: 每1000字的积分消耗
- 积分按实际字数比例计算，结果保留3位小数，截取而不四舍五入
- 可以在提交任务前调用此接口检查积分是否足够

---