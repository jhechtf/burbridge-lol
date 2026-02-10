import type { CollectionConfig } from "payload";
import { slugField } from 'payload';

export const Other: CollectionConfig = {
  slug: 'others',
  admin: {
    useAsTitle: 'title',
  },
  versions: {
    drafts: true
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'contents',
      type: 'richText',
      required: true,
    },
    slugField(),
  ]
}