# Scripts

`check-dist.mjs` checks the built page before it is published: size under 16 MB, scripts only from cdnjs / jsdelivr npm / unpkg, stylesheets only from Google Fonts, no other external `src`/`href` resources (plain `<a href>` links are fine), and no `dangerouslySetInnerHTML` in app source (the built bundle always contains that string because React names the prop, so the check reads `src/`).

Run `npm run build && node scripts/check-dist.mjs`, then publish `dist/index.html` with the `CAPABILITIES` object exported from `src/data/artifact/runtime.ts`.
