// Site themes ("palettes"): one per composer plus a neutral concert-grand default.
// Each palette sets the accent colour (light and dark mode), the keyboard
// background and a colour for each of the 12 pitch classes on the visual piano.
// Scriabin's palette is his own colour-key scheme; the others spread a colour
// gradient around the circle of fifths so related keys get related colours.

import { PITCH_CLASSES, SCRIABIN_COLOURS } from './scriabin';

export const PALETTE_IDS = ['concert', 'bach', 'mozart', 'chopin', 'liszt', 'scriabin', 'ravel', 'hamelin'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];
export const DEFAULT_PALETTE: PaletteId = 'concert';

/** Page backgrounds the accent colour must stay readable on (see global.css). */
export const LIGHT_PAGE_BACKGROUND = '#f8f4ea';
export const DARK_PAGE_BACKGROUND = '#15120e';
/** Text colour on accent-coloured backgrounds (buttons), per mode. */
export const ON_ACCENT = { light: '#ffffff', dark: '#10131a' } as const;

export interface Palette {
	id: PaletteId;
	label: string;
	accent: { light: string; dark: string };
	/** Background of the keyboard panel. */
	keyboard: string;
	/** Colour per pitch class, C to B. */
	pitchColours: string[];
	/** Names for the colours, only where the composer gave them (Scriabin). */
	colourNames?: string[];
}

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
	const match = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!match) throw new Error(`Invalid colour ${hex}`);
	const value = parseInt(match[1], 16);
	return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function rgbToHex([r, g, b]: Rgb): string {
	return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/** Colour at position t (0–1) along evenly spaced gradient stops. */
export function gradientAt(stops: string[], t: number): string {
	if (stops.length === 1) return stops[0].toLowerCase();
	const scaled = Math.min(1, Math.max(0, t)) * (stops.length - 1);
	const index = Math.min(stops.length - 2, Math.floor(scaled));
	const local = scaled - index;
	const from = hexToRgb(stops[index]);
	const to = hexToRgb(stops[index + 1]);
	return rgbToHex([0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * local) as Rgb);
}

/** Position of a pitch class on the circle of fifths (C = 0, G = 1, D = 2 …). */
export function circleOfFifthsIndex(pitchClass: number): number {
	return (pitchClass * 7) % 12;
}

/** Colours for C…B from gradient stops laid around the circle of fifths. */
export function pitchColoursFromStops(stops: string[]): string[] {
	return Array.from({ length: 12 }, (_, pc) => gradientAt(stops, circleOfFifthsIndex(pc) / 11));
}

/** WCAG relative luminance and contrast ratio. */
export function contrastRatio(a: string, b: string): number {
	const luminance = (hex: string) => {
		const [r, g, b] = hexToRgb(hex).map((channel) => {
			const c = channel / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

const palette = (
	id: PaletteId,
	label: string,
	accent: Palette['accent'],
	keyboard: string,
	stops: string[],
): Palette => ({ id, label, accent, keyboard, pitchColours: pitchColoursFromStops(stops) });

export const PALETTES: Record<PaletteId, Palette> = {
	concert: palette('concert', 'Concert grand', { light: '#7d5f1c', dark: '#e2c27a' }, '#101010', [
		'#b08d57',
		'#f1e3b5',
		'#8a6a2f',
		'#d8c08a',
	]),
	bach: palette('bach', 'Bach · Baroque', { light: '#8a4b14', dark: '#e3a75f' }, '#1c120a', [
		'#7b4a1e',
		'#c08a3e',
		'#e9c46a',
		'#a3542a',
	]),
	mozart: palette('mozart', 'Mozart · Classical', { light: '#a8385c', dark: '#f2a7bd' }, '#1a1420', [
		'#e7a1b0',
		'#f3d9a4',
		'#a8d5c2',
		'#9fb7e8',
	]),
	chopin: palette('chopin', 'Chopin · Romantic', { light: '#3d4f9a', dark: '#aab8ff' }, '#0b1020', [
		'#2b4c8c',
		'#6a4c93',
		'#c06c84',
		'#f1c0b9',
	]),
	liszt: palette('liszt', 'Liszt · Virtuoso', { light: '#b3122e', dark: '#ff8a8a' }, '#140808', [
		'#7a0b0b',
		'#d7263d',
		'#f46036',
		'#ffd166',
	]),
	scriabin: {
		id: 'scriabin',
		label: 'Scriabin · Colour-key',
		accent: { light: '#5b2bd6', dark: '#b9a2ff' },
		keyboard: '#0d0b16',
		pitchColours: PITCH_CLASSES.map((pc) => SCRIABIN_COLOURS[pc].hex),
		colourNames: PITCH_CLASSES.map((pc) => SCRIABIN_COLOURS[pc].name),
	},
	ravel: palette('ravel', 'Ravel · Impressionist', { light: '#0d6f7b', dark: '#7fd8e0' }, '#06161b', [
		'#0b6e7f',
		'#26a69a',
		'#7fd1c7',
		'#c7ecee',
		'#5b8def',
	]),
	hamelin: palette('hamelin', 'Hamelin · Modern virtuoso', { light: '#006aa3', dark: '#5cd0ff' }, '#0a0c10', [
		'#3a3f4b',
		'#00c2ff',
		'#9b5cff',
		'#e6e6e6',
	]),
};

export function isPaletteId(value: unknown): value is PaletteId {
	return typeof value === 'string' && (PALETTE_IDS as readonly string[]).includes(value);
}

/** Colour of a MIDI note in a palette. */
export function keyColour(paletteId: PaletteId, midi: number): string {
	return PALETTES[paletteId].pitchColours[((midi % 12) + 12) % 12];
}

const variables = (p: Palette, mode: 'light' | 'dark') =>
	[
		`--accent: ${p.accent[mode]};`,
		`--keyboard-bg: ${p.keyboard};`,
		// The keyboard panel is always dark, so it uses the dark-mode accent in both modes.
		`--keyboard-accent: ${p.accent.dark};`,
		...p.pitchColours.map((colour, pc) => `--pc-${pc}: ${colour};`),
	].join(' ');

/**
 * CSS custom properties for every palette. A palette applies to the whole page
 * via <html data-palette="…">, or to one element (e.g. a composer's keyboard)
 * via data-palette on that element. The default applies when none is set.
 */
export function paletteCss(): string {
	const defaults = PALETTES[DEFAULT_PALETTE];
	const rules = [
		`:root { ${variables(defaults, 'light')} --on-accent: ${ON_ACCENT.light}; }`,
		`:root[data-theme='dark'] { --accent: ${defaults.accent.dark}; --on-accent: ${ON_ACCENT.dark}; }`,
	];
	for (const p of Object.values(PALETTES)) {
		rules.push(`:root[data-palette='${p.id}'], [data-palette='${p.id}'] { ${variables(p, 'light')} }`);
		rules.push(
			`:root[data-theme='dark'][data-palette='${p.id}'], :root[data-theme='dark'] [data-palette='${p.id}'] { --accent: ${p.accent.dark}; }`,
		);
	}
	return rules.join('\n');
}
