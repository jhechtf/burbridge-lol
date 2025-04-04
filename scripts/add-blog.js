#!/usr/env/bin node
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const today = new Date();

/**
 *
 * @param {Intl.DateTimeFormatPart[]} parts
 */
function partsToObject(parts) {
  /** @type {Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>} */
  const obj = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      obj[part.type] = part.value;
    }
  }
  return obj;
}

const formatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const obj = partsToObject(formatter.formatToParts(today));

console.log('Creating new blog post...');

const fileName = `src/content/blogs/${obj.year}/${obj.month}/${obj.day}/${obj.hour}${obj.minute}${obj.second}.md`;
const baseContent = `---
title:
tags:
  - 
draft: true
---`;

console.log(`Writing file to ${fileName}`);
await mkdir(dirname(fileName), { recursive: true });
await writeFile(fileName, baseContent, { flag: 'w+' });
