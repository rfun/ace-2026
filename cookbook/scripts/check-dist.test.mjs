import { describe, expect, it } from 'vitest';
import { checkHtml, checkSource } from './check-dist-lib.mjs';

const page = (body) => `<!doctype html><html><head>${body}</head><body></body></html>`;

describe('checkHtml', () => {
  it('accepts a clean inline page (catches false positives on bundled JS strings)', () => {
    const html = page('<style>a{color:red}</style><script type="module">const s="<script src=\\"https://evil.test/x.js\\">";</script>');
    expect(checkHtml(html)).toEqual([]);
  });
  it.each(['https://cdnjs.cloudflare.com/ajax/x.js', 'https://cdn.jsdelivr.net/npm/x@1/x.js', 'https://unpkg.com/x@1.0.0/x.js'])(
    'allows script from %s (catches over-blocking an allowed CDN)',
    (u) => expect(checkHtml(page(`<script src="${u}"></script>`))).toEqual([]),
  );
  it('blocks a script from another host (catches a missing script allowlist)', () => {
    expect(checkHtml(page('<script src="https://evil.test/x.js"></script>'))).toHaveLength(1);
  });
  it('blocks a script from a lookalike prefix (catches substring matching instead of prefix)', () => {
    expect(checkHtml(page('<script src="https://evil.test/https://unpkg.com/x.js"></script>'))).toHaveLength(1);
  });
  it('allows Google Fonts stylesheet, blocks other stylesheets', () => {
    expect(checkHtml(page('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">'))).toEqual([]);
    expect(checkHtml(page('<link rel="stylesheet" href="https://cdn.example.com/a.css">'))).toHaveLength(1);
  });
  it('blocks external img and protocol-relative src but allows <a href> (catches missing generic resource check)', () => {
    expect(checkHtml('<img src="https://x.test/a.png">')).toHaveLength(1);
    expect(checkHtml('<img src="//x.test/a.png">')).toHaveLength(1);
    expect(checkHtml('<a href="https://example.com">hi</a>')).toEqual([]);
  });
  it('allows data: and relative references', () => {
    expect(checkHtml('<img src="data:image/png;base64,AAAA"><img src="/_blob/abc">')).toEqual([]);
  });
  it('fails a page over 16 MB (catches a missing size limit)', () => {
    const big = page('') + 'x'.repeat(16 * 1024 * 1024);
    expect(checkHtml(big).some((p) => p.includes('byte limit'))).toBe(true);
  });
});

describe('checkSource', () => {
  it('flags dangerouslySetInnerHTML', () => {
    expect(checkSource('<div dangerouslySetInnerHTML={x}/>', 'a.tsx')).toHaveLength(1);
    expect(checkSource('<div>ok</div>', 'a.tsx')).toEqual([]);
  });
});
