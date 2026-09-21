import { describe, expect, it } from 'vitest';
import { formatDate } from './date';

describe('formatDate', () => {
	it('formats a date with a short month name', () => {
		expect(formatDate(new Date(2024, 5, 1))).toBe('Jun 1, 2024');
	});

	it('formats single-digit days without padding', () => {
		expect(formatDate(new Date(2024, 0, 8))).toBe('Jan 8, 2024');
	});
});