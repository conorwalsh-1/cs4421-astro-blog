import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, DARK_PAGE_BACKGROUND, LIGHT_PAGE_BACKGROUND, rgbToHex } from '../utils/palettes';

// The page colours live in global.css; these tests keep them readable and in sync
// with the constants the palette contrast tests use.
const css = readFileSync('src/styles/global.css', 'utf8');
const block = (selector: string) => {
	const start = css.indexOf(`${selector} {`);
	return css.slice(start, css.indexOf('}', start));
};
const token = (selector: string, name: string) => {
	const value = new RegExp(`--${name}:\s*([^;]+);`).exec(block(selector))?.[1].trim();
	if (!value) throw new Error(`--${name} not found in ${selector}`);
	return value.startsWith('#') ? value : rgbToHex(value.split(',').map(Number) as [number, number, number]);
};

describe.each([
	[':root', LIGHT_PAGE_BACKGROUND],
	[":root[data-theme='dark']", DARK_PAGE_BACKGROUND],
])('%s page colours', (selector, background) => {
	it('match the background the palette tests check against', () => {
		expect(token(selector, 'page-bg')).toBe(background);
	});

	it('keep body text, headings and secondary text readable (WCAG AA)', () => {
		for (const name of ['gray-dark', 'black', 'gray']) {
			expect(contrastRatio(token(selector, name), background)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(token(selector, name), token(selector, 'surface'))).toBeGreaterThanOrEqual(4.5);
		}
	});
});
