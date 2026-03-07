import { getPayload } from "payload";
import { config } from '@burbridge/payload';

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
  return getPayload({ config })
}