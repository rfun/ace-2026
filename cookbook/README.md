# ACE Cookbook

Vite + React 18 + TypeScript app. Built into a single self-contained page that is published as a Claude artifact.

## Commands

```
npm ci            # install exact pinned dependencies
npm run dev       # dev server
npm run typecheck # tsc strict
npm test          # vitest (jsdom)
npm run build     # emits dist/index.html
npm run check:dist # pre-publish checks on dist/index.html (run after build)
npm run release   # typecheck, test, build, then check:dist; exits non-zero on any failure
```

`dist/index.html` has all JS and CSS inlined (vite-plugin-singlefile) and is the artifact page. Only the Google Fonts stylesheet is loaded externally.

Data goes through the `DataStore` interface (`src/data/store.ts`); `createMockStore()` is the in-memory/localStorage implementation seeded with clearly-fake sample recipes.

## Publishing

1. `npm run release` (typecheck, tests, build, dist check). Fix anything it reports.
2. Publish `dist/index.html` as the artifact page, declaring `CAPABILITIES` from `src/data/artifact/runtime.ts`.
