import { visit } from 'unist-util-visit';

/**
 * Maps a GitHub-style alert keyword to a semantic callout variant + label.
 * Keeping this table here (rather than inline) makes adding a variant a
 * one-line change and keeps the transform logic dumb.
 */
const VARIANTS = {
  NOTE: { variant: 'note', label: 'Note' },
  TIP: { variant: 'tip', label: 'Tip' },
  INFO: { variant: 'note', label: 'Info' },
  WARNING: { variant: 'warn', label: 'Warning' },
  IMPORTANT: { variant: 'warn', label: 'Important' },
  DANGER: { variant: 'danger', label: 'Danger' },
  CAUTION: { variant: 'danger', label: 'Caution' },
};

const MARKER = /^\[!(\w+)\]\s*(.*)$/s;

/**
 * remark plugin: rewrites blockquotes whose first line is `[!TYPE] text…`
 * into `<aside class="callout callout-<variant>" data-label="…">`.
 *
 * Authors write plain Markdown:
 *
 *   > [!WARNING] Don't do the thing.
 *
 * The matching `[!TYPE]` marker is stripped from the rendered text; the label
 * is surfaced via `data-label` and rendered by CSS, so no extra DOM is added.
 */
export function remarkCallouts() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      const paragraph = node.children?.[0];
      if (!paragraph || paragraph.type !== 'paragraph') return;

      const textNode = paragraph.children?.[0];
      if (!textNode || textNode.type !== 'text') return;

      const match = textNode.value.match(MARKER);
      if (!match) return;

      const def = VARIANTS[match[1].toUpperCase()];
      if (!def) return;

      // Strip the marker, keep any trailing inline content on the same line.
      textNode.value = match[2];
      if (textNode.value === '') paragraph.children.shift();

      node.data = node.data ?? {};
      node.data.hName = 'aside';
      node.data.hProperties = {
        className: ['callout', `callout-${def.variant}`],
        'data-label': def.label,
      };
    });
  };
}

export default remarkCallouts;
