# Project Context

## Purpose
星辰写作 - 一个基于 AI 的论文重写应用，提供智能文本重写、用户管理和积分系统。该应用包括前端界面和后端 API 服务，通过 Hono 框架提供高性能的云端函数服务。

## Tech Stack
### 核心技术栈
- **TypeScript** - 主要开发语言，类型安全
- **Vue 3** - 前端框架，支持 Composition API
- **Hono** - 后端 Web 框架，专为 Edge Runtime 优化
- **Element Plus** - Vue 3 UI 组件库
- **Tailwind CSS** - 原子化 CSS 框架
- **Vite** - 前端构建工具
- **pnpm** - 包管理器，支持 monorepo

### 后端服务
- **Supabase** - 数据库和认证服务
- **Zod** - 数据验证和类型安全
- **marked** - Markdown 解析
- **highlight.js** - 代码高亮
- **standardwebhooks** - Webhook 验证

### 部署和运维
- **EdgeOne** - 腾讯云边缘计算平台
- **Cloudflare Workers** - 边缘计算运行时
- **KV 存储** - 键值存储服务

## Project Conventions

### Code Style
- 使用 **@antfu/eslint-config** 作为 ESLint 配置基础
- 支持中英文混合注释，优先使用中文注释
- 采用 Vue 3 Composition API 和 `<script setup>` 语法
- 组件命名采用 PascalCase，文件名使用 kebab-case
- 使用 TypeScript 严格模式，确保类型安全

### Architecture Patterns
- **Monorepo 结构** - 使用 pnpm workspace 管理多包项目
- **模块化路由** - 后端采用模块化路由设计（/book, /upload, /user, /sms 等）
- **组合式 API** - 前端使用 Vue 3 Composition API
- **响应式设计** - 支持移动端和桌面端自适应
- **Edge-First** - 优先考虑边缘计算优化

### Testing Strategy
- 使用 **Vitest** 作为单元测试框架
- 测试环境配置为 Node.js
- 测试覆盖率报告集成到 CI/CD 流程
- API 测试覆盖用户认证、数据验证等核心功能

### Git Workflow
- 主分支：`main`
- 开发分支：`develop/server`
- 提交信息遵循约定式提交规范（feat:, fix:, chore: 等）
- 自动化版本管理使用 **bumpp**
- 代码提交前自动运行 ESLint 检查

## Domain Context
### 应用领域
- **学术论文重写** - 提供智能文本重写服务
- **用户管理** - 注册、登录、权限控制
- **积分系统** - 消费记录、余额管理、充值功能
- **内容管理** - 文档上传、处理、展示

### 业务逻辑
- 用户通过手机号注册，支持短信验证
- 积分消费系统，每次重写操作扣除相应积分
- 支持多种文档格式处理
- 实时用户状态和余额显示

## Important Constraints
- **边缘计算限制** - 代码需要兼容 Cloudflare Workers 和 EdgeOne 运行时
- **无服务器架构** - 不能依赖传统的文件系统操作
- **类型安全** - 所有 API 必须使用 TypeScript 和 Zod 进行类型验证
- **性能要求** - 响应时间必须在边缘计算限制内
- **数据安全** - 用户数据和交易记录需要加密保护

## External Dependencies
### 核心服务
- **Supabase** - 用户数据存储和认证
- **腾讯云 SMS** - 短信验证服务
- **EdgeOne** - 云端函数部署平台

### 开发工具
- **unplugin-auto-import** - Vue 组件自动导入
- **unplugin-vue-components** - 组件按需加载
- **vite-plugin-svg-icons** - SVG 图标管理
