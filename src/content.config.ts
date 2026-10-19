import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PITCH_CLASSES } from './utils/scriabin';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			// Tonal centre of the post; the header is lit in Scriabin's colour for this key.
			key: z.enum(PITCH_CLASSES).optional(),
			author: reference('authors'),
		}),
});

const authors = defineCollection({
	loader: glob({ base: './src/content/authors', pattern: '**/*.md' }),
	schema: ({ image }) =>
		z.object({
			name: z.string(),
			bio: z.string(),
			avatar: image(),
			links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
		}),
});

export const collections = { blog, authors };
