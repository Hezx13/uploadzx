/**
 * Static, app-wide metadata. Centralized so titles, links, and version badges
 * never drift across components.
 */
export const site = {
  name: 'uploadzx',
  tagline: 'Browser upload toolkit',
  description:
    'A browser-only TypeScript upload library: resumable tus uploads, a concurrency-capped queue, IndexedDB persistence, pluggable transports, and first-class React bindings.',
  version: '0.1.4',
  links: {
    github: 'https://github.com/Hezx13/uploadzx',
    npm: 'https://www.npmjs.com/package/uploadzx',
    issues: 'https://github.com/Hezx13/uploadzx/issues',
  },
} as const;

export type Site = typeof site;
