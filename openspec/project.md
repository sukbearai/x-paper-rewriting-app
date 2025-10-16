# Project Context

## Purpose
这是一个名为"星辰写作"的AI写作助手全栈Web应用。该应用提供论文重写、内容生成等功能，用户可以通过前端界面使用AI写作工具，系统还包含用户认证、短信验证、余额充值等完整的用户管理功能。

## Tech Stack
### 前端 (Client)
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI组件库**: Element Plus
- **样式**: Tailwind CSS
- **状态管理**: Pinia + pinia-plugin-persistedstate
- **路由**: Vue Router
- **HTTP客户端**: Axios
- **开发工具**: unplugin-auto-import, unplugin-vue-components

### 后端 (Server)
- **运行时**: Cloudflare Functions (Edge One Pages)
- **框架**: Hono
- **数据库**: Supabase
- **短信服务**: 腾讯云SMS
- **类型验证**: Zod
- **Webhook验证**: standardwebhooks
- **文档**: Marked + highlight.js

### 开发工具
- **包管理**: pnpm (Monorepo)
- **代码规范**: ESLint (@antfu/eslint-config)
- **测试**: Vitest
- **构建**: unbuild
- **类型检查**: TypeScript

## Project Conventions

### Code Style
- 使用 @antfu/eslint-config 作为代码规范基础
- TypeScript 严格模式
- Vue 3 Composition API + `<script setup>` 语法
- 函数式组件优先，使用 Pinia 进行状态管理
- 中文注释和变量命名混合使用
- 文件命名使用 kebab-case，组件使用 PascalCase

### Architecture Patterns
- **Monorepo架构**: 使用 pnpm workspace 管理多个包和应用
- **全栈分离**: 前后端独立部署，通过API通信
- **Edge Computing**: 后端部署在Cloudflare Edge One Pages
- **微服务路由**: 使用Hono路由器模块化API端点
- **类型安全**: 前后端全TypeScript覆盖，Zod验证API数据

### Testing Strategy
- 使用 Vitest 进行单元测试
- 测试覆盖率报告：`pnpm test:coverage`
- 测试文件位于各包的 `__tests__` 或 `test` 目录

### Git Workflow
- **主分支**: main (生产环境)
- **开发分支**: develop/server (当前工作分支)
- **提交规范**: 使用 conventional commits 格式
- **代码审查**: 所有PR必须通过代码审查
- **自动化**: 使用 bumpp 进行版本管理

## Domain Context
这是一个AI写作助手平台，主要服务于学术论文写作和内容重写需求：
- **核心功能**: AI论文重写、内容生成
- **用户系统**: 手机号注册、短信验证、余额管理
- **商业模式**: 按使用量计费，用户充值消费
- **技术特点**: 边缘计算部署，低延迟响应

## Important Constraints
- **部署平台**: 前端可部署到任意静态托管，后端必须部署到Edge One Pages
- **数据库**: 必须使用Supabase作为用户数据存储
- **短信服务**: 短信验证功能依赖腾讯云SMS服务
- **环境变量**: 生产环境需要配置完整的环境变量（数据库连接、短信服务等）
- **浏览器兼容性**: 需要支持现代浏览器（ES2020+）

## External Dependencies
- **Supabase**: 用户数据库、认证服务、Webhook
- **腾讯云SMS**: 短信验证码发送服务
- **Edge One Pages**: Cloudflare边缘计算平台
- **Element Plus**: UI组件库
- **Tailwind CSS**: 样式框架
