import { type CollectionConfig, slugField } from "payload";

export const Tag: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'display'
  },
  fields: [
    {
      name: 'display',
      type: 'text',
    },
    slugField({
      useAsSlug: 'display'
    }),
    {
      name: 'scope',
      type: 'text',
      required: false,
    }
  ]
}