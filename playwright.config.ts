import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;

// End-to-end tests run against the production build of the Node server.
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'on-first-retry',
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
	],
	webServer: {
		command: 'node ./dist/server/entry.mjs',
		url: `http://localhost:${PORT}/api/health`,
		env: { HOST: '127.0.0.1', PORT: String(PORT) },
		reuseExistingServer: !process.env.CI,
	},
});
