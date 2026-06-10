// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

import { remarkCallouts } from './src/plugins/remark-callouts.mjs';

/**
 * Astro configuration.
 *
 * - Content lives in Markdown/MDX under `src/content/docs` (see `content.config.ts`).
 * - `remarkCallouts` turns GitHub-style `> [!NOTE]` blockquotes into styled
 *   `<aside class="callout">` elements, so authors stay in pure Markdown.
 * - Code highlighting uses Shiki's warm, minimal "vesper" theme to match the
 *   site's monochrome + single-accent identity.
 *
 * `site` / `base` are read from env so the same build can target a custom domain
 * or a sub-path (e.g. GitHub Pages) without code changes.
 */
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://uploadzx.dev',
  base: process.env.BASE_PATH ?? '/',
  markdown: {
    remarkPlugins: [remarkCallouts],
    shikiConfig: {
      theme: 'vesper',
      wrap: false,
    },
  },
  integrations: [mdx()],
});
