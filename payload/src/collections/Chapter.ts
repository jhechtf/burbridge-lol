import { slugField, type CollectionConfig } from "payload";

export const Chapter: CollectionConfig = {
  slug: 'chapters',
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
      name: 'contents',
      type: 'richText'
    },
    slugField(),
    {
      name: 'chapterNumber',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'story',
      type: 'relationship',
      relationTo: 'stories',
      hasMany: false,
    }
  ]
}