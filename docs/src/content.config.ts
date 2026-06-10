import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro:schema';

/**
 * The `docs` collection is the single content source for the site. Markdown and
 * MDX files under `src/content/docs/<group>/<page>.md` become routes at
 * `/docs/<group>/<page>` (see `src/pages/docs/[...slug].astro`).
 *
 * Page *ordering* and *grouping* are intentionally NOT derived from the file
 * tree — they live in `src/config/navigation.ts`, the single source of truth for
 * the sidebar and prev/next links. Frontmatter only describes the page itself.
 */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { docs };
