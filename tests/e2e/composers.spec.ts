import { expect, test } from '@playwright/test';

const COMPOSERS = [
	{ id: 'bach', name: 'Johann Sebastian Bach', years: '1685–1750', palette: 'bach' },
	{ id: 'mozart', name: 'Wolfgang Amadeus Mozart', years: '1756–1791', palette: 'mozart' },
	{ id: 'chopin', name: 'Frédéric Chopin', years: '1810–1849', palette: 'chopin' },
	{ id: 'liszt', name: 'Franz Liszt', years: '1811–1886', palette: 'liszt' },
	{ id: 'scriabin', name: 'Alexander Scriabin', years: '1872–1915', palette: 'scriabin' },
	{ id: 'ravel', name: 'Maurice Ravel', years: '1875–1937', palette: 'ravel' },
	{ id: 'hamelin', name: 'Marc-André Hamelin', years: 'Born 1961', palette: 'hamelin' },
];

test.describe('composers through the ages', () => {
	test('the index lists all seven composers in chronological order', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Composers', exact: true }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Composers through the ages' })).toBeVisible();

		await expect(page.locator('.cards h2')).toHaveText(COMPOSERS.map((c) => c.name));
		await expect(page.locator('.timeline li')).toHaveCount(7);
		await expect(page.locator('.timeline li').last()).toContainText('b. 1961');
	});

	for (const composer of COMPOSERS) {
		test(`${composer.name}: profile, palette and a demo that plays on the piano`, async ({ page }) => {
			await page.goto(`/composers/${composer.id}/`);

			await expect(page.getByRole('heading', { level: 1, name: composer.name })).toBeVisible();
			await expect(page.locator('.meta')).toContainText(composer.years);
			await expect(page.locator('article')).toHaveAttribute('data-palette', composer.palette);

			await page.getByRole('button', { name: '▶ Play demo' }).click();
			await expect(page.locator('.colour-keyboard .key.active').first()).toBeVisible();
			await page.getByRole('button', { name: '■ Stop' }).click();
			await expect(page.getByRole('button', { name: '▶ Play demo' })).toBeVisible();
		});
	}

	test('pages link to the composers before and after', async ({ page }) => {
		await page.goto('/composers/bach/');
		const pager = page.getByRole('navigation', { name: 'Other composers' });
		await expect(pager.getByRole('link', { name: /Earlier/ })).toHaveCount(0);
		await pager.getByRole('link', { name: /Later.*Mozart/ }).click();

		await expect(page).toHaveURL(/\/composers\/mozart\/$/);
		await expect(pager.getByRole('link', { name: /Earlier.*Bach/ })).toBeVisible();
	});

	test("a composer's theme can be applied to the whole site", async ({ page }) => {
		await page.goto('/composers/ravel/');
		await page.getByRole('button', { name: 'Use the Ravel theme on the whole site' }).click();

		await expect(page.locator('html')).toHaveAttribute('data-palette', 'ravel');
		await expect(page.getByLabel('Colour theme')).toHaveValue('ravel');
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('data-palette', 'ravel');
	});

	test('journal posts and composer pages link to each other', async ({ page }) => {
		await page.goto('/composers/scriabin/');
		await page.getByRole('complementary').getByRole('link', { name: 'Hearing in colour: the clavier à lumières' }).click();

		await expect(page.locator('article')).toHaveAttribute('data-palette', 'scriabin');
		await page.getByRole('link', { name: 'Alexander Scriabin' }).click();
		await expect(page).toHaveURL(/\/composers\/scriabin\/$/);
	});
});
