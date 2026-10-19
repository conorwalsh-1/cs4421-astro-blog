import { describe, expect, it } from 'vitest';
import {
	circleOfFifthsIndex,
	contrastRatio,
	DARK_PAGE_BACKGROUND,
	DEFAULT_PALETTE,
	gradientAt,
	hexToRgb,
	isPaletteId,
	keyColour,
	LIGHT_PAGE_BACKGROUND,
	ON_ACCENT,
	PALETTE_IDS,
	PALETTES,
	paletteCss,
	pitchColoursFromStops,
	rgbToHex,
} from './palettes';
import { SCRIABIN_COLOURS } from './scriabin';

const HEX = /^#[0-9a-f]{6}$/i;

describe('colour helpers', () => {
	it('round-trips hex and RGB', () => {
		expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
		expect(rgbToHex([255, 128, 0])).toBe('#ff8000');
		expect(() => hexToRgb('red')).toThrow();
	});

	it('interpolates gradient stops', () => {
		expect(gradientAt(['#000000', '#ffffff'], 0)).toBe('#000000');
		expect(gradientAt(['#000000', '#ffffff'], 0.5)).toBe('#808080');
		expect(gradientAt(['#000000', '#ff0000', '#ffffff'], 1)).toBe('#ffffff');
		expect(gradientAt(['#123456'], 0.7)).toBe('#123456');
	});

	it('orders pitch classes around the circle of fifths', () => {
		// C G D A E B F# C# G# D# A# F
		expect([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map(circleOfFifthsIndex)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
		]);
	});

	it('gives C the first stop and F the last', () => {
		const colours = pitchColoursFromStops(['#000000', '#ffffff']);
		expect(colours[0]).toBe('#000000');
		expect(colours[5]).toBe('#ffffff');
	});

	it('computes WCAG contrast ratios', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
		expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1);
	});
});

describe('palettes', () => {
	it('defines every palette with 12 valid pitch colours', () => {
		expect(Object.keys(PALETTES)).toEqual([...PALETTE_IDS]);
		for (const palette of Object.values(PALETTES)) {
			expect(palette.pitchColours).toHaveLength(12);
			for (const colour of [...palette.pitchColours, palette.accent.light, palette.accent.dark, palette.keyboard]) {
				expect(colour).toMatch(HEX);
			}
		}
	});

	it.each(PALETTE_IDS)('keeps the %s accent readable (WCAG AA 4.5:1) in light and dark mode', (id) => {
		const { accent } = PALETTES[id];
		expect(contrastRatio(accent.light, LIGHT_PAGE_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(accent.dark, DARK_PAGE_BACKGROUND)).toBeGreaterThanOrEqual(4.5);
	});

	it.each(PALETTE_IDS)('keeps button text readable on the %s accent in light and dark mode', (id) => {
		const { accent } = PALETTES[id];
		expect(contrastRatio(ON_ACCENT.light, accent.light)).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(ON_ACCENT.dark, accent.dark)).toBeGreaterThanOrEqual(4.5);
	});

	it("keeps Scriabin's own colours and names unchanged", () => {
		expect(keyColour('scriabin', 60)).toBe(SCRIABIN_COLOURS.C.hex);
		expect(keyColour('scriabin', 66)).toBe(SCRIABIN_COLOURS['F#'].hex);
		expect(PALETTES.scriabin.colourNames?.[0]).toBe('red');
	});

	it('only Scriabin names his colours', () => {
		expect(PALETTE_IDS.filter((id) => PALETTES[id].colourNames)).toEqual(['scriabin']);
	});

	it('colours every octave of a note the same', () => {
		expect(keyColour('ravel', 21)).toBe(keyColour('ravel', 105));
	});

	it('validates palette ids', () => {
		expect(isPaletteId('bach')).toBe(true);
		expect(isPaletteId('beethoven')).toBe(false);
		expect(isPaletteId(undefined)).toBe(false);
		expect(DEFAULT_PALETTE).toBe('concert');
	});
});

describe('paletteCss', () => {
	const css = paletteCss();

	it('sets the default palette on :root', () => {
		expect(css).toContain(`:root { --accent: ${PALETTES.concert.accent.light};`);
	});

	it('scopes every palette to the page and to single elements, in both modes', () => {
		for (const id of PALETTE_IDS) {
			expect(css).toContain(`:root[data-palette='${id}'], [data-palette='${id}']`);
			expect(css).toContain(`:root[data-theme='dark'] [data-palette='${id}'] { --accent: ${PALETTES[id].accent.dark}; }`);
		}
		expect(css).toContain(`--pc-11: ${PALETTES.liszt.pitchColours[11]};`);
		expect(css).toContain(`--keyboard-accent: ${PALETTES.mozart.accent.dark};`);
	});

	it('keeps the keyboard accent readable on every keyboard background', () => {
		for (const palette of Object.values(PALETTES)) {
			expect(contrastRatio(palette.accent.dark, palette.keyboard)).toBeGreaterThanOrEqual(4.5);
		}
	});
});
