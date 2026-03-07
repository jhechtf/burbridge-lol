import { type CollectionConfig, slugField } from "payload";

export const Blog: CollectionConfig = {
	slug: "blogs",
	admin: {
		useAsTitle: "title",
	},
	versions: {
		drafts: true,
	},
	fields: [
		{
			name: "title",
			type: "text",
			required: true,
		},
		{
			type: "upload",
			name: "header",
			relationTo: "media",
			required: false,
		},
		{
			name: "contents",
			type: "richText",
			required: true,
		},
		slugField(),
		{
			name: "tags",
			type: "relationship",
			hasMany: true,
			relationTo: "tags",
		},
	],
};
