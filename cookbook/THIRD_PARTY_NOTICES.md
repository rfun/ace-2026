# Third-party notices

## heic-to (and libheif)

- Package: [heic-to](https://github.com/hoppergee/heic-to) 1.6.7 (pinned exactly in `package.json`)
- Licence: GNU Lesser General Public License v3.0 (LGPL-3.0). It bundles [libheif](https://github.com/strukturag/libheif) 1.23.7 (LGPL-3.0) and its codec dependencies.
- Use: converts a HEIC/HEIF photo to JPEG in the browser when the browser cannot decode it.
- Distribution: **shipped unmodified, as a separate file** (`heic-to.js`, the package's `dist/csp/heic-to.js`), loaded on demand with a dynamic `import()`. It is not merged or linked into the application bundle (`index.html`). The file is copied byte for byte from `node_modules/heic-to/dist/csp/` by `scripts/heic-converter-plugin.mjs`, so it can be replaced by any other build of the same package version.
- Source: the package source and the libheif source are available at the repository links above. The licence text is in `node_modules/heic-to/LICENSE` and at https://www.gnu.org/licenses/lgpl-3.0.html.

## Other dependencies

React, React DOM and the build tools are MIT licensed; see each package in `node_modules`.
