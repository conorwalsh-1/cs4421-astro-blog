import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PALETTE_IDS } from './utils/palettes';
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
			// The composer the post is about; the post page takes on their colour palette.
			composer: reference('composers').optional(),
		}),
});

export const ERAS = ['Baroque', 'Classical', 'Romantic', 'Late Romantic', 'Impressionist', 'Contemporary'] as const;

const composers = defineCollection({
	loader: glob({ base: './src/content/composers', pattern: '**/*.md' }),
	schema: z.object({
		name: z.string(),
		shortName: z.string(),
		born: z.number().int(),
		/** Omitted for living composers. */
		died: z.number().int().optional(),
		birthplace: z.string(),
		era: z.enum(ERAS),
		/** Chronological position on the timeline. */
		order: z.number().int().positive(),
		palette: z.enum(PALETTE_IDS),
		tagline: z.string(),
		instrument: z.string(),
		works: z
			.array(z.object({ title: z.string(), year: z.string().optional(), note: z.string().optional() }))
			.min(3),
		listenFor: z.array(z.string()).min(2),
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

export const collections = { blog, authors, composers };
