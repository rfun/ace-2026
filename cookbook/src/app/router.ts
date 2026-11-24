import { useEffect, useState } from 'react';

export type Route =
  | { name: 'browse' }
  | { name: 'recipe'; id: string }
  | { name: 'compose'; id?: string }
  | { name: 'kitchen'; id: string };

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter((p) => p.length > 0);
  const id = parts[1] === undefined ? undefined : safeDecode(parts[1]);
  if (parts.length === 2 && id && parts[0] === 'recipe') return { name: 'recipe', id };
  if (parts.length === 2 && id && parts[0] === 'kitchen') return { name: 'kitchen', id };
  if (parts.length === 1 && parts[0] === 'compose') return { name: 'compose' };
  if (parts.length === 2 && id && parts[0] === 'compose') return { name: 'compose', id };
  return { name: 'browse' };
}

export function formatHash(route: Route): string {
  switch (route.name) {
    case 'browse':
      return '#/';
    case 'recipe':
      return `#/recipe/${encodeURIComponent(route.id)}`;
    case 'compose':
      return route.id ? `#/compose/${encodeURIComponent(route.id)}` : '#/compose';
    case 'kitchen':
      return `#/kitchen/${encodeURIComponent(route.id)}`;
  }
}

export function navigate(route: Route): void {
  const next = formatHash(route);
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseHash(hash);
}
