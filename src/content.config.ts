import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const storiesCollection = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/stories'}),
  schema: z.object({
    author: z.string(),
    title: z.string(),
    tags: z.array(z.string()),
    chapter: z.number().min(0),
    draft: z.boolean().default(true)
  }),
  // @ts-ignore I know this is hacky I don't care
  name: 'Stories',
});

export const collections = {
  stories: storiesCollection,
};