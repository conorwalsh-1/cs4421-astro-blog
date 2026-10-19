import { expect, test } from '@playwright/test';

test.describe('score player', () => {
	test('plays the MusicXML demo, lighting keys as it goes', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('link', { name: 'Player', exact: true }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'Score player' })).toBeVisible();

		await page.getByRole('button', { name: /Prometheus Study/ }).click();
		await expect(page.locator('[data-score-title]')).toHaveText('Prometheus Study');
		await expect(page.locator('[data-score-meta]')).toHaveText('MusicXML · 36 notes · 0:21');

		await page.getByRole('button', { name: '▶ Play' }).click();
		await expect(page.getByRole('button', { name: '❚❚ Pause' })).toBeVisible();
		// The opening left-hand chord (C3, F#3, Bb3) lights up.
		await expect(page.locator('.key.active[data-midi="48"]')).toBeVisible();
		await expect(page.locator('[data-clock]')).toHaveText(/^0:0[1-9] \/ 0:21$/, { timeout: 5000 });

		await page.getByRole('button', { name: '❚❚ Pause' }).click();
		const paused = await page.locator('[data-clock]').textContent();
		await page.waitForTimeout(1200);
		await expect(page.locator('[data-clock]')).toHaveText(paused!);

		await page.getByRole('button', { name: /Stop/ }).click();
		await expect(page.locator('[data-clock]')).toHaveText('0:00 / 0:21');
		await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible();
	});

	test('loads a MIDI file chosen from disk', async ({ page }) => {
		await page.goto('/player');
		await page.locator('[data-file-input]').setInputFiles('public/scores/mystic-arpeggios.mid');

		await expect(page.locator('[data-score-title]')).toHaveText('Mystic chord arpeggios');
		await expect(page.locator('[data-score-meta]')).toHaveText('MIDI · 100 notes · 0:20');
		await expect(page.locator('[data-status]')).toHaveText('Ready: C2–D7. Press Play (or Space).');
		await expect(page.getByRole('button', { name: '▶ Play' })).toBeEnabled();
	});

	test('explains that a PDF of sheet music must be exported first', async ({ page }) => {
		await page.goto('/player');
		await page.locator('[data-file-input]').setInputFiles({
			name: 'prelude.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.7 not really'),
		});

		await expect(page.locator('[data-status]')).toHaveClass(/error/);
		await expect(page.locator('[data-status]')).toContainText('Export the score as MusicXML');
		await expect(page.getByRole('button', { name: '▶ Play' })).toBeDisabled();
	});

	test('does not play the keyboard while a form control has focus', async ({ page }) => {
		await page.goto('/player');
		const nowPlaying = page.locator('[data-now-playing]');
		const before = await nowPlaying.textContent();

		await page.locator('[data-speed]').focus();
		await page.keyboard.press('a');
		await expect(nowPlaying).toHaveText(before!);

		await page.getByRole('heading', { level: 1, name: 'Score player' }).click();
		await page.keyboard.press('a');
		await expect(nowPlaying).toHaveText('C4');
	});
});
