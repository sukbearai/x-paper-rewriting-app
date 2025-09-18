## Monorepo Productivity Guide for AI Agents

Concise, project-specific rules so generated changes align with the real architecture (avoid generic advice).

### 1. High-Level Architecture
- pnpm monorepo. Two runtime apps plus shared libraries.
  - `apps/server`: EdgeOne Pages Functions app (Hono + JSX SSR + static fallback).
  - `apps/client`: Vite + Vue 3 playground/demo (standalone; not built by root build script).
- Shared libraries in `packages/*` (design system, utilities, CLI, preset). Root `pnpm build` only builds these packages.
- Edge runtime version pinned in `edgeone.json` (Node 22.13.0). Keep server code Node‑compatible (no unsupported APIs for EdgeOne Functions environment).

### 2. Core Workflows
- Install: run once at root: `pnpm i`.
- Lint / Fix: `pnpm lint` / `pnpm lint:fix` (Antfu config).
- Test: `pnpm test` (Vitest, node env, loads `dotenv/config`). Add new tests under `packages/*/test` or root `test/`.
- Build shared packages: `pnpm build` (clears `packages/*/dist` then runs each package build). Does NOT build apps.
- Server app (from `apps/server`):
  - Dev: `pnpm dev` (EdgeOne Pages local dev).
  - Build: `pnpm build` (regenerates `public/index.html` via `scripts/sync-docs.js` so keep that script idempotent).
  - Deploy: `pnpm deploy` (EdgeOne CLI; ensure new routes exported & no TS errors).
- Client app (from `apps/client`): `pnpm dev`, `pnpm build`, `pnpm preview`.

### 3. Server (Hono + JSX) Conventions
- Entry: `functions/index.tsx` creates `new Hono().basePath('/')`, mounts routers with `app.route('/<name>', router)`.
- Routers: each file in `functions/routers/` exports a `Hono` instance (`export default router`). Aggregated in `routers/index.ts`.
- SSR: Use `c.html(Content(props))`; `Content` comes from `functions/components/Layout.tsx`. Do not import React; TS config sets `jsxImportSource: hono/jsx`.
- Static fallback: Unmatched paths go through custom `notFound` handler that rewrites `/` to `/index.html` in `public/`. Preserve this when adding 404 logic.
- Error pages: Keep existing inline HTML structure for 404/500 (update styling minimally; keep semantic structure & links).
- Optional IP restriction middleware is present but commented—retain comments when modifying surrounding code.

### 4. Adding / Modifying Routes
1. Create `apps/server/functions/routers/<feature>.tsx` with `const feature = new Hono()`.
2. Export it via `functions/routers/index.ts`.
3. Mount in `functions/index.tsx`: `app.route('/<feature>', feature)`.
4. For SSR output use `c.html(Content({ name, siteData: { title }, children: <div>...</div> }))`.
5. For JSON APIs, return `c.json({ success: true, ... })` (follow pattern in `book.post('/')`).

### 5. Shared Packages (Purpose Snapshot)
- `packages/logger`: Thin consola wrapper via `useLogger(tag)`; reuse instead of creating new loggers.
- `packages/utils`: Re-export grouped helpers (`types`, `vue`, `excel`). Add new utility modules and export through `index.ts`.
- `packages/ui`: UI defaults + UnoCSS integration (`index.ts` imports `uno.css`). Keep side-effect import first.
- `packages/preset`: Custom UnoCSS preset (`presetXui`). When adding rules/shortcuts, register in respective folders and ensure they are exported through the preset.
- `packages/x-dev-tools`: CLI (scaffolding + OSS upload). Extend by adding actions to the prompt in `cli.ts`; keep interactive flow + error handling patterns.

### 6. Testing & Quality
- New shared logic should have Vitest tests mirroring existing examples in `packages/nuxt-kit/test` and root `test/` directory.
- Use `dotenv` for env setup if required (already auto-loaded via `vitest.config.ts`).

### 7. Deployment & Generated Docs
- Server build regenerates `apps/server/public/index.html` from its README (`scripts/sync-docs.js`). If altering README layout, confirm the script still parses correctly.
- Don’t hand-edit generated `public/index.html`; change the README instead.

### 8. Logging & Env
- Use `useLogger()` for consistent tagging (`x-dev-tools` base tag). Avoid creating raw `console` noise in shared packages.
- Global `my_kv` declared in `functions/index.tsx` (EdgeOne KV namespace). If utilized, type lives in `functions/env.ts`—extend there first.

### 9. PR / Change Guidance for AI
- Prefer minimal, localized edits; preserve existing HTML template semantics.
- When expanding server features, keep router modular—do not overload `index.tsx`.
- Avoid introducing new build steps; reuse existing scripts unless strictly necessary.
- Before suggesting refactors, ensure compatibility with EdgeOne Functions constraints.

### 10. Quick Examples
Add API route: create `routers/ping.ts` → export Hono with `ping.get('/', c => c.json({ ok: true }))` → export & mount → deploy.
Add SSR page: in router handler `return c.html(Content({ name: 'Hello', siteData: { title: 'Hello' }, children: <div>Hi</div> }))`.

---
If any area is unclear (e.g. extending preset or CLI flows), ask for clarification before large changes.
