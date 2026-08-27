# React RealWorld Example App

## Commands

```bash
bun run setup         # Init submodules + install deps (run after clone or after realworld submodule update)
bun run start         # Dev server at localhost:4200
bun run test          # Unit tests (Vitest)
bun run test:e2e      # E2E tests (Playwright)
bun run format        # Format code with Prettier
bun run format:check  # Check formatting without writing
```

## Code Style

- Run `bun run format` before presenting code to the user.

## Debug Interface

E2E tests use `window.__conduit_debug__` to access app state. See `realworld/specs/e2e/helpers/debug.ts` for the contract.

## Angular → React

Concept mapping (guards, interceptors, services, RxJS) lives in `ANGULAR_TO_REACT.md`.
