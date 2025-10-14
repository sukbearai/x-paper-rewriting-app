# Task Completion Checklist
- Ensure modified packages build locally with `pnpm build` if shared logic changed.
- Execute `pnpm lint` and address issues; run `pnpm test` when behavior changes or new logic is added.
- For server updates, confirm EdgeOne runtime compatibility and update router exports/mounting when adding routes.
- Avoid hand-editing generated files; adjust source (e.g., README) and rerun relevant scripts instead.