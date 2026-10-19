import { expect, test } from '@playwright/test';

test.describe('home page colour keyboard', () => {
	test('lights a key in its palette colour when played', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('heading', { level: 1, name: 'Pianoforte' })).toBeVisible();

		await page.getByRole('button', { name: 'C4', exact: true }).dispatchEvent('pointerdown');

		await expect(page.locator('[data-now-playing]')).toHaveText('C4');
		await expect(page.locator('.key[data-midi="60"]')).toHaveClass(/active/);
	});

	test('plays and names the six notes of the Mystic chord in Scriabin colours', async ({ page }) => {
		await page.goto('/blog/the-mystic-chord/');
		await page.getByRole('button', { name: 'Play the Mystic chord' }).click();

		await expect(page.locator('[data-now-playing]')).toContainText('C4 · red');
		await expect(page.locator('[data-now-playing]')).toContainText('D6 · yellow');
	});

	test('is a full 88-key piano that scrolls instead of shrinking', async ({ page }) => {
		await page.goto('/');

		await expect(page.locator('.colour-keyboard .key')).toHaveCount(88);
		await expect(page.getByRole('button', { name: 'A0', exact: true })).toBeAttached();
		await expect(page.getByRole('button', { name: 'C8', exact: true })).toBeAttached();

		const scroller = page.locator('[data-keys-scroll]');
		const { scrollWidth, clientWidth } = await scroller.evaluate((el) => ({
			scrollWidth: el.scrollWidth,
			clientWidth: el.clientWidth,
		}));
		expect(scrollWidth).toBeGreaterThan(clientWidth);
		// Starts scrolled to middle C, where the computer keys play.
		await expect(page.getByRole('button', { name: 'C4', exact: true })).toBeInViewport();
	});

	test('computer keys play from the selected octave, and Z / X shift it', async ({ page }) => {
		await page.goto('/');
		const nowPlaying = page.locator('[data-now-playing]');
		const octaveLabel = page.locator('[data-octave-label]');

		await page.keyboard.press('a');
		await expect(nowPlaying).toHaveText('C4');
		await page.keyboard.press('w');
		await expect(nowPlaying).toHaveText('C#4');

		await page.keyboard.press('x');
		await expect(octaveLabel).toHaveText('Keys play C5–E6');
		await page.keyboard.press('a');
		await expect(nowPlaying).toHaveText('C5');
		await expect(page.locator('.key[data-midi="72"] [data-shortcut-label]')).toHaveText('A');

		await page.keyboard.press('z');
		await page.keyboard.press('z');
		await expect(octaveLabel).toHaveText('Keys play C3–E4');
		await expect(page.getByRole('button', { name: 'C3', exact: true })).toBeInViewport();
	});

	test('octave buttons stop at the ends of the piano', async ({ page }) => {
		await page.goto('/');
		const down = page.getByRole('button', { name: /down an octave/ });

		for (let i = 0; i < 4; i++) await down.click();
		await expect(page.locator('[data-octave-label]')).toHaveText('Keys play A0–E1');
		await expect(down).toBeDisabled();
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
