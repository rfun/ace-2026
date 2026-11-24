// Pure checks for the built single-file page. No dependencies.

export const MAX_BYTES = 16 * 1024 * 1024;
export const SCRIPT_ORIGINS = ['https://cdnjs.cloudflare.com/', 'https://cdn.jsdelivr.net/npm/', 'https://unpkg.com/'];
export const STYLE_ORIGINS = ['https://fonts.googleapis.com/'];

const EXTERNAL = /^\s*(https?:)?\/\//i;

function attr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

const startsWithAny = (url, origins) => origins.some((o) => url.trim().startsWith(o));

/** Returns one message per problem found in the html (empty array = OK). */
export function checkHtml(html) {
  const problems = [];
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > MAX_BYTES) problems.push(`page is ${bytes} bytes, over the ${MAX_BYTES} byte limit`);

  // The artifact publisher refuses a page containing a literal U+FFFD (a lost character).
  const lines = html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('\uFFFD')) problems.push(`literal U+FFFD (replacement character) on line ${i + 1}; write it as an escape in source`);
  }

  // Inline script/style bodies are code, not markup: blank them so strings inside do not look like tags.
  const markup = html.replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2>)/gi, '$1$3');

  for (const m of markup.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const src = attr(attrs, 'src');
    const href = attr(attrs, 'href');

    if (tag === 'script') {
      if (src !== undefined && !startsWithAny(src, SCRIPT_ORIGINS)) problems.push(`script src not allowed: ${src}`);
      continue;
    }
    if (tag === 'link') {
      const rel = (attr(attrs, 'rel') ?? '').toLowerCase();
      if (rel.split(/\s+/).includes('stylesheet')) {
        if (href !== undefined && !startsWithAny(href, STYLE_ORIGINS)) problems.push(`stylesheet not allowed: ${href}`);
        continue;
      }
    }
    if (tag === 'a') continue; // plain links are fine
    for (const [name, value] of [['src', src], ['href', href]]) {
      if (value !== undefined && EXTERNAL.test(value)) problems.push(`external ${name} on <${tag}> not allowed: ${value}`);
    }
  }
  return problems;
}

/** Flags dangerouslySetInnerHTML and literal U+FFFD (write it as an escape) in app source text. */
export function checkSource(text, file) {
  const problems = [];
  if (text.includes('dangerouslySetInnerHTML')) problems.push(`dangerouslySetInnerHTML used in ${file}`);
  const line = text.split('\n').findIndex((l) => l.includes('\uFFFD'));
  if (line >= 0) problems.push(`literal U+FFFD (replacement character) in ${file} line ${line + 1}; write it as an escape`);
  return problems;
}
