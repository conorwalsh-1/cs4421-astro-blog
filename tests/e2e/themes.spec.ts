import { expect, test, type Page } from '@playwright/test';

/** The palette colour a key resolves to (its --pc-<pitch class> custom property). */
const keyColour = (page: Page, midi: number) =>
	page
		.locator(`.colour-keyboard .key[data-midi="${midi}"]`)
		.first()
		.evaluate((key, pc) => getComputedStyle(key).getPropertyValue(`--pc-${pc}`).trim(), midi % 12);

const accent = (page: Page) =>
	page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());

test.describe('composer colour themes', () => {
	test('starts on the Concert grand theme', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByLabel('Colour theme')).toHaveValue('concert');
		expect(await accent(page)).toBe('#7d5f1c');
	});

	test("switching to Scriabin recolours the site and names the keyboard's colours", async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Colour theme').selectOption('scriabin');

		await expect(page.locator('html')).toHaveAttribute('data-palette', 'scriabin');
		expect(await accent(page)).toBe('#5b2bd6');
		expect(await keyColour(page, 60)).toBe('#ff0000'); // Scriabin's red C

		await page.keyboard.press('a');
		await expect(page.locator('[data-now-playing]')).toHaveText('C4 · red');
	});

	test('remembers the chosen theme across pages and reloads', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Colour theme').selectOption('liszt');
		await page.goto('/player');

		await expect(page.locator('html')).toHaveAttribute('data-palette', 'liszt');
		await expect(page.getByLabel('Colour theme')).toHaveValue('liszt');
		expect(await accent(page)).toBe('#b3122e');
	});

	test('uses the dark-mode accent of the theme', async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Colour theme').selectOption('ravel');
		await page.getByRole('button', { name: 'Switch to dark mode' }).click();

		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		expect(await accent(page)).toBe('#7fd8e0');
	});

	test("a keyboard pinned to Scriabin keeps his colours whatever the site theme", async ({ page }) => {
		await page.goto('/');
		await page.getByLabel('Colour theme').selectOption('bach');
		await page.goto('/blog/the-mystic-chord/');

		expect(await keyColour(page, 66)).toBe('#7f8bfd'); // F#: bright blue
	});
});
