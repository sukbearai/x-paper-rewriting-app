# Suggested Commands
- `pnpm i` – install workspace dependencies.
- `pnpm build` – build shared packages (clears `packages/*/dist` and rebuilds each package).
- `pnpm lint` / `pnpm lint:fix` – run Antfu ESLint setup and auto-fix issues.
- `pnpm test` – execute Vitest suite (loads `dotenv/config`).
- `pnpm --filter apps/server dev` – run EdgeOne Pages Functions dev server.
- `pnpm --filter apps/server build` – build server app (also regenerates `apps/server/public/index.html`).
- `pnpm --filter apps/server deploy` – deploy server via EdgeOne CLI.
- `pnpm --filter apps/client dev|build|preview` – run the Vue 3 playground app workflows.