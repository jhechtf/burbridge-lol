import { type CollectionConfig, slugField } from "payload";

export const Tag: CollectionConfig = {
	slug: "tags",
	admin: {
		useAsTitle: "display",
	},
	versions: {
		drafts: true,
	},
	fields: [
		{
			name: "name",
			type: "text",
			required: true,
		},
		{
			name: "display",
			type: "text",
			required: true,
		},
		slugField({
			useAsSlug: "display",
		}),
		{
			name: "scope",
			type: "text",
			required: false,
		},
		{
			name: "blogs",
			type: "relationship",
			hasMany: true,
			relationTo: "blogs",
		},
		{
			name: "stories",
			type: "relationship",
			hasMany: true,
			relationTo: "stories",
		},
		{
			name: "others",
			type: "relationship",
			hasMany: true,
			relationTo: "others",
		},
	],
};
