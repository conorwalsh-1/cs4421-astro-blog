import { expect, test } from '@playwright/test';

test.describe('home page colour keyboard', () => {
	test('lights a key in its Scriabin colour when played', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1, name: 'Mysterium' })).toBeVisible();

		await page.getByRole('button', { name: 'C4', exact: true }).dispatchEvent('pointerdown');

		await expect(page.locator('[data-now-playing]')).toHaveText('C4 · red');
		await expect(page.locator('.key[data-midi="60"]')).toHaveClass(/active/);
	});

	test('plays and names the six notes of the Mystic chord', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: 'Play the Mystic chord' }).click();

		await expect(page.locator('[data-now-playing]')).toContainText('C4 · red');
		await expect(page.locator('[data-now-playing]')).toContainText('D6 · yellow');
	});
});

test.describe('journal', () => {
	test('lists posts and opens one with its key colour', async ({ page }) => {
		await page.goto('/blog/');
		await page.getByRole('link', { name: /The Mystic chord, played and lit/ }).click();

		await expect(page).toHaveURL(/\/blog\/the-mystic-chord\/$/);
		await expect(page.getByText('In C: red')).toBeVisible();
		await expect(page.getByText('Written by')).toBeVisible();
	});
});

test.describe('listening room', () => {
	test('a visitor can leave a note that appears lit in its key', async ({ page }) => {
		const piece = `Vers la flamme ${Date.now()}`;
		await page.goto('/listening-room');

		await page.getByLabel('Your name').fill('E2E Pianist');
		await page.getByLabel('Piece').fill(piece);
		await page.getByLabel('Favourite key').selectOption('E');
		await page.getByLabel('Note').fill('Toward the flame.');
		await page.getByRole('button', { name: 'Leave a note' }).click();

		const note = page.locator('.note', { hasText: piece });
		await expect(note).toBeVisible();
		await expect(note).toContainText('in E');
	});
});

test('health endpoint reports ok', async ({ request }) => {
	const response = await request.get('/api/health');
	expect(response.status()).toBe(200);
	expect((await response.json()).status).toBe('ok');
});
