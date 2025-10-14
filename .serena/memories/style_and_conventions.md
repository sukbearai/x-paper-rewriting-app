# Style & Conventions
- Prefer minimal, localized edits that align with existing architecture; preserve generated assets (e.g., `apps/server/public/index.html` regenerated via script).
- Server routes use Hono routers (`new Hono()`) exported and mounted via `functions/index.tsx`; SSR responses use `Content` component with hono/jsx runtime (no React imports).
- Follow shared utilities: use `useLogger` from `packages/logger` instead of raw console; reuse Supabase helpers in `apps/server/utils/db.ts` and `createSuccessResponse` / `createErrorResponse` helpers for API payloads.
- Keep server code EdgeOne-compatible (Node 22.13.0); avoid unsupported APIs and retain documented IP restriction comments when present.
- Shared packages expose utilities through index barrels; any new helper must be exported accordingly.
- Comments should be sparse and explanatory only around non-obvious logic.