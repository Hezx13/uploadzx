# uploadzx documentation

The documentation site for [uploadzx](https://github.com/Hezx13/uploadzx), built
with [Astro](https://astro.build).

## Commands

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:4321)
npm run build    # build the static site to ./dist
npm run preview  # preview the production build
npm run check    # type-check Astro + TypeScript
```

## Architecture

The site separates **content**, **structure**, and **presentation** so each can
change independently.

```
docs/
├─ astro.config.mjs            # Astro + Markdown (Shiki) + MDX config
├─ src/
│  ├─ content.config.ts        # `docs` content collection schema
│  ├─ content/docs/            # the documentation, as Markdown/MDX
│  │  ├─ getting-started/
│  │  ├─ core/
│  │  ├─ react/
│  │  ├─ guides/
│  │  └─ reference/
│  ├─ config/
│  │  ├─ site.ts               # site metadata (name, links, version)
│  │  └─ navigation.ts         # sidebar groups + order (single source of truth)
│  ├─ lib/navigation.ts        # pure helpers (prev/next, hrefs)
│  ├─ plugins/
│  │  └─ remark-callouts.mjs   # `> [!NOTE]` → styled <aside> (pure-Markdown callouts)
│  ├─ styles/
│  │  ├─ tokens.css            # design tokens — THE theme (primitives + semantics)
│  │  ├─ global.css            # base + layout chrome + buttons
│  │  └─ prose.css             # rendered-Markdown styling
│  ├─ components/
│  │  ├─ layout/               # Header, Sidebar, Toc, Pagination
│  │  └─ content/              # Hero, FeatureGrid, Callout (renderer sections)
│  ├─ layouts/                 # BaseLayout, DocsLayout
│  └─ pages/
│     ├─ index.astro           # landing page (custom rendered sections)
│     └─ docs/[...slug].astro  # renders any content entry
└─ public/                     # static assets (favicon)
```

### Key ideas

- **Content is Markdown.** Add a page by dropping a `.md`/`.mdx` file under
  `src/content/docs/<group>/` and registering its slug in
  `src/config/navigation.ts`. Custom, non-prose sections (hero, feature grid)
  are Astro components rendered on the landing page (or importable into MDX).
- **One source of truth for IA.** `navigation.ts` drives the sidebar order,
  grouping, and prev/next pagination. The file tree does not encode order.
- **Theme via tokens.** All colors, spacing, type, motion, and layout values are
  CSS custom properties in `tokens.css`. Components reference only semantic
  tokens (`--color-*`, `--space-*`, …), so retuning the brand or adding a theme
  is a one-file change.
- **Callouts stay in Markdown.** Authors write `> [!WARNING] …`; a remark plugin
  rewrites it to a styled `<aside>` — no per-file component imports required.

## Authoring a page

1. Create `src/content/docs/<group>/<page>.md` with frontmatter:

   ```md
   ---
   title: My page
   description: One-line summary shown under the title and in <meta>.
   ---

   ## A section

   Body copy. Use fenced code blocks, tables, and `> [!NOTE]` callouts.
   ```

2. Add `{ slug: '<group>/<page>', title: 'My page' }` to the right group in
   `src/config/navigation.ts`.
