# Project Overview
- PNPM monorepo for "x-paper-rewriting-app" delivering a paper rewriting web application.
- Contains EdgeOne Pages Functions server (`apps/server`, Hono + JSX SSR) and a separate Vite + Vue 3 playground client (`apps/client`).
- Shared libraries live under `packages/*` (design system/UI, preset, utils, CLI, logger) and are the focus of the root build pipeline.
- Must respect EdgeOne runtime (Node 22.13.0) conventions defined in `edgeone.json`.