import { slugField, type CollectionConfig } from "payload";

export const Story: CollectionConfig = {
  slug: 'stories',
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
    slugField(),
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'contents',
      type: 'richText',
    },
    {
      name: 'chapters',
      type: 'relationship',
      relationTo: 'chapters',
      hasMany: true,
    }
  ]
}