/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
	test: {
		include: ['src/**/*.test.ts', 'tests/integration/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/utils/**/*.ts', 'src/pages/api/**/*.ts'],
			// Browser-only Web Audio synth; exercised by the Playwright E2E tests instead.
			exclude: ['src/utils/piano.ts', '**/*.test.ts'],
			thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
		},
	},
});
