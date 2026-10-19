// @ts-check

import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// Self-hosted fonts (SIL Open Font License; see src/assets/fonts/*-OFL.txt), split into
// Latin and Latin Extended files so accented names (Żelazowa Wola, Doborján) render
// without downloading extended glyphs on every page.
const LATIN =
	'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
	'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

/**
 * @template T
 * @param {T[]} list
 * @returns {[T, ...T[]]}
 */
const nonEmpty = (list) => {
	if (list.length === 0) throw new Error('A font family needs at least one variant');
	return /** @type {[T, ...T[]]} */ (list);
};

/** @param {string} family @param {[number, 'normal' | 'italic'][]} styles */
const variants = (family, styles) =>
	nonEmpty(
		styles.flatMap(([weight, style]) =>
			/** @type {const} */ ([
				['latin', LATIN],
				['latin-ext', LATIN_EXT],
			]).map(([subset, range]) => ({
				src: /** @type {[string]} */ ([`./src/assets/fonts/${family}-${subset}-${weight}-${style}.woff2`]),
				weight,
				style,
				display: /** @type {const} */ ('swap'),
				unicodeRange: /** @type {[string]} */ ([range]),
			})),
		),
	);

// https://astro.build/config
export default defineConfig({
	site: 'https://example.com',
	output: 'server', // Enables on-demand server rendering
	adapter: node({
		mode: 'standalone', // Self-contained HTTP server listening on a port
	}),
	integrations: [mdx(), sitemap()],
	fonts: [
		{
			// Body text: EB Garamond, a revival of Claude Garamont's 16th-century types.
			provider: fontProviders.local(),
			name: 'EB Garamond',
			cssVariable: '--font-text',
			// Symbol fonts render ♯ and ♭ (missing from Garamond) as text, not colour emoji.
			fallbacks: ['Garamond', 'Georgia', 'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', 'serif'],
			options: {
				variants: variants('eb-garamond', [
					[400, 'normal'],
					[400, 'italic'],
					[600, 'normal'],
					[600, 'italic'],
				]),
			},
		},
		{
			// Headings: Cormorant Garamond, a display Garamond with fine, high-contrast strokes.
			provider: fontProviders.local(),
			name: 'Cormorant Garamond',
			cssVariable: '--font-display',
			// Symbol fonts render ♯ and ♭ (missing from Garamond) as text, not colour emoji.
			fallbacks: ['Garamond', 'Georgia', 'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', 'serif'],
			options: {
				variants: variants('cormorant-garamond', [
					[500, 'normal'],
					[500, 'italic'],
					[600, 'normal'],
					[700, 'normal'],
				]),
			},
		},
	],
});
