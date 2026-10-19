import { describe, expect, it } from 'vitest';
import { FeedbackStore, feedbackSchema } from './feedback';

describe('feedbackSchema', () => {
	it('accepts a note with a valid key', () => {
		const result = feedbackSchema.safeParse({ name: 'Conor', piece: 'Vers la flamme', key: 'E' });
		expect(result.success).toBe(true);
	});

	it('rejects a key that is not a pitch class', () => {
		const result = feedbackSchema.safeParse({ name: 'Conor', piece: 'Sonata 5', key: 'H' });
		expect(result.success).toBe(false);
	});

	it('rejects an empty name', () => {
		const result = feedbackSchema.safeParse({ name: '  ', piece: 'Sonata 5', key: 'F#' });
		expect(result.success).toBe(false);
	});
});

describe('FeedbackStore', () => {
	it('lists the newest note first', () => {
		const store = new FeedbackStore();
		store.add({ name: 'A', piece: 'Op. 8 No. 12', key: 'D#', message: '' });
		store.add({ name: 'B', piece: 'Prometheus', key: 'F#', message: '' });

		expect(store.list().map((entry) => entry.name)).toEqual(['B', 'A']);
	});

	it('keeps at most 50 notes', () => {
		const store = new FeedbackStore();
		for (let i = 0; i < 60; i++) store.add({ name: `n${i}`, piece: 'p', key: 'C', message: '' });

		expect(store.list()).toHaveLength(50);
	});
});
