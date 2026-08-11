/**
 * The documentation information architecture — the single source of truth for:
 *   - the sidebar (groups + order)
 *   - prev/next pagination
 *   - which content slugs are expected to exist
 *
 * A `slug` here maps 1:1 to a content entry id (the path under
 * `src/content/docs` without extension) and to the route `/docs/<slug>`.
 *
 * Reordering or regrouping the docs is a change to THIS file only — content
 * files and components never encode order.
 */
export interface NavItem {
  /** Content id / route slug, e.g. `getting-started/introduction`. */
  slug: string;
  /** Sidebar + page label. */
  title: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: 'Getting started',
    items: [
      { slug: 'getting-started/introduction', title: 'Introduction' },
      { slug: 'getting-started/installation', title: 'Installation' },
      { slug: 'getting-started/quick-start', title: 'Quick start' },
      { slug: 'getting-started/concepts', title: 'Core concepts' },
      { slug: 'getting-started/architecture', title: 'Architecture' },
    ],
  },
  {
    label: 'Core API',
    items: [
      { slug: 'core/options', title: 'Configuration options' },
      { slug: 'core/methods', title: 'Instance methods' },
      { slug: 'core/events', title: 'Events' },
      { slug: 'core/drivers', title: 'Transport drivers' },
      { slug: 'core/custom-driver', title: 'Writing a driver' },
      { slug: 'core/types', title: 'Type reference' },
    ],
  },
  {
    label: 'React',
    items: [
      { slug: 'react/setup', title: 'Setup & Provider' },
      { slug: 'react/hooks', title: 'Hooks reference' },
      { slug: 'react/components', title: 'Components' },
      { slug: 'react/performance', title: 'Performance model' },
      { slug: 'react/recipes', title: 'Recipes' },
    ],
  },
  {
    label: 'Guides',
    items: [
      { slug: 'guides/persistence', title: 'Persistence & resume' },
      { slug: 'guides/integrity', title: 'Integrity & checksums' },
      { slug: 'guides/validation', title: 'Validation' },
      { slug: 'guides/auth', title: 'Dynamic auth' },
      { slug: 'guides/ssr', title: 'SSR & environments' },
      { slug: 'guides/browser-support', title: 'Browser support' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { slug: 'reference/faq', title: 'FAQ' },
      { slug: 'reference/contributing', title: 'Contributing' },
      { slug: 'reference/project-structure', title: 'Project structure' },
    ],
  },
];

/** The first doc page — used for "Read the docs" entry points and `/docs`. */
export const firstDocSlug = navigation[0].items[0].slug;
