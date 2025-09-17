# Copilot instructions for this repo

Make agents productive by following this repo’s real architecture and workflows. Prefer concrete patterns from code over generic tips.

## Mental model
- Monorepo (pnpm). Two apps:
  - `apps/server`: EdgeOne Pages Functions app using Hono + JSX, also serves static docs generated from its `README.md`.
  - `apps/client`: Vite + Vue 3 demo (standalone).
- Shared libs in `packages/*`; root build only targets these packages. EdgeOne runtime set in `edgeone.json`.

## Run and build
- Install once at root: `pnpm i`.
- Lint (Antfu): `pnpm lint` / `pnpm lint:fix`. Tests (Vitest/node): `pnpm test` / `pnpm test:coverage`.
- Server (from `apps/server`):
  - Dev: `pnpm dev` (EdgeOne Pages dev).
  - Build: `pnpm build` → runs `scripts/sync-docs.js` to regenerate `public/index.html` from `README.md`.
  - Deploy: `pnpm deploy` (EdgeOne CLI, project `paper-rewriting-app-server`).
- Client (from `apps/client`): `pnpm dev` / `pnpm build` / `pnpm preview`.
- Root `pnpm build` builds only `packages/*` (not apps).

## Server patterns (Hono + JSX)
- TS config enforces `jsx: react-jsx` with `jsxImportSource: hono/jsx` → never import React.
- Entrypoint `functions/index.tsx`:
  - `const app = new Hono().basePath('/')`; mount modules with `app.route('/path', module)`.
  - Export EdgeOne handler: `export function onRequest(...) { return app.fetch(request, env) }`.
  - 404/500 HTML templates; unknown paths fall back to `public/` (rewrite `/` → `/index.html`).
- Routers live in `functions/routers/*`, each `export default new Hono()`. Aggregated by `functions/routers/index.ts`.
- SSR with `hono/html`; use `functions/components/Layout.tsx` and return `c.html(<Content {...props} />)`.

## Add a new route (API/SSR)
1) Create `apps/server/functions/routers/<name>.tsx` with `const <name> = new Hono()` and `export default <name>`.
2) Export in `functions/routers/index.ts`; mount in `functions/index.tsx` via `app.route('/<name>', <name>)`.
3) For SSR, render via `c.html(<Content {...props} />)` and set page title through `Layout` props.

## EdgeOne specifics
- Platform types in `functions/env.ts`; global `my_kv` declared (not used yet). IP restriction middleware exists but is commented out.

## Notes for contributors
- Keep static assets in `apps/server/public/`; preserve notFound fallback behavior.
- Favor modular routers and server-side JSX. For shared libs, run root `pnpm build`.
