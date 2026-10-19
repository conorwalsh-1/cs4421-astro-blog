import { describe, expect, it } from 'vitest';
import { formatRequestLog, levelForStatus } from './logger';

describe('levelForStatus', () => {
	it('logs successful requests as INFO', () => {
		expect(levelForStatus(200)).toBe('INFO');
	});

	it('logs client errors as WARN', () => {
		expect(levelForStatus(404)).toBe('WARN');
	});

	it('logs server errors as ERROR', () => {
		expect(levelForStatus(503)).toBe('ERROR');
	});
});

describe('formatRequestLog', () => {
	it('emits one structured JSON object with the request fields', () => {
		const line = formatRequestLog(
			{ route: '/api/feedback', method: 'POST', statusCode: 200, latencyMs: 42 },
			new Date('2026-09-28T14:32:01.120Z'),
		);

		expect(JSON.parse(line)).toEqual({
			timestamp: '2026-09-28T14:32:01.120Z',
			level: 'INFO',
			route: '/api/feedback',
			method: 'POST',
			statusCode: 200,
			latencyMs: 42,
		});
	});
});
