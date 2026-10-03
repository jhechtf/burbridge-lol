import { config } from '@burbridge/payload';
import { type Where, getPayload } from 'payload';

export type Contents =
  | {
      type: 'text';
      text: string;
      code?: boolean;
      bold?: boolean;
      italic?: boolean;
    }
  | {
      type: 'paragraph';
      children: Contents[];
    }
  | {
      type: 'heading';
      children: Contents[];
      level: number;
    };

export function calculateReadingTime(contents: Contents[]): number {
  /**
   * 1. Iterate over the top level contents
   * 2. If type === paragraph, split the text attribute to get the number of words.
   * 3. If anything else, add the children element to the queue.
   */
  const queue = contents.slice();
  let words = 0;
  let current: Contents = queue.shift();

  while (current) {
    if (current.type === 'text')
      words += current.text.trim().split(/\s+/).length;
    else queue.unshift(...current.children);
    current = queue.shift();
  }

  return Math.round(words / 255);
}

export function getPayloadInstance() {
  return getPayload({ config });
}

/** Drafts are only included when running the dev server. */
export const includeDrafts = import.meta.env.DEV;

/**
 * `draft: false` alone does not exclude never-published documents, and the
 * Local API bypasses access control, so production builds filter explicitly.
 */
export const publishedOnly: Where | undefined = includeDrafts
  ? undefined
  : { _status: { equals: 'published' } };

/** Filters populated relationships down to the docs that should be rendered. */
export function isVisible<T extends { _status?: string | null }>(
  doc: number | T,
): doc is T {
  return (
    typeof doc === 'object' && (includeDrafts || doc._status === 'published')
  );
}
