import { type CollectionConfig, slugField } from "payload";

export const Blog: CollectionConfig = {
  slug: 'blogs',
  admin: {
    useAsTitle: 'title'
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      type: 'upload',
      name: 'header',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'contents',
      type: 'richText'
    },
    slugField(),
  ]
}