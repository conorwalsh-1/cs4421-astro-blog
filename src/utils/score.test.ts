import { describe, expect, it } from 'vitest';
import { buildTempoMap, finishScore, firstNoteAtOrAfter, formatClock, positionToSeconds } from './score';

describe('positionToSeconds', () => {
	const map = buildTempoMap(
		[
			{ at: 4, secondsPerUnit: 0.25 },
			{ at: 8, secondsPerUnit: 1 },
		],
		0.5,
	);

	it('converts within the first tempo', () => {
		expect(positionToSeconds(2, map)).toBe(1);
	});

	it('accumulates across tempo changes', () => {
		expect(positionToSeconds(6, map)).toBe(2 + 0.5);
		expect(positionToSeconds(10, map)).toBe(2 + 1 + 2);
	});

	it('returns 0 at the start', () => {
		expect(positionToSeconds(0, map)).toBe(0);
	});
});

describe('buildTempoMap', () => {
	it('lets a tempo at position 0 replace the default', () => {
		expect(buildTempoMap([{ at: 0, secondsPerUnit: 1 }], 0.5)).toEqual([{ at: 0, secondsPerUnit: 1 }]);
	});
});

describe('finishScore', () => {
	it('sorts notes, drops zero-length ones and measures the length', () => {
		const score = finishScore('t', 'MIDI', [
			{ midi: 64, time: 1, duration: 2, velocity: 1 },
			{ midi: 60, time: 0, duration: 0, velocity: 1 },
			{ midi: 62, time: 0.5, duration: 0.5, velocity: 1 },
		]);
		expect(score.notes.map((n) => n.midi)).toEqual([62, 64]);
		expect(score.duration).toBe(3);
	});
});

describe('firstNoteAtOrAfter', () => {
	const notes = [0, 1, 1, 2, 5].map((time) => ({ midi: 60, time, duration: 1, velocity: 1 }));

	it('finds the first note at a time', () => {
		expect(firstNoteAtOrAfter(notes, 1)).toBe(1);
	});

	it('finds the next note between times', () => {
		expect(firstNoteAtOrAfter(notes, 3)).toBe(4);
	});

	it('returns the length past the end', () => {
		expect(firstNoteAtOrAfter(notes, 9)).toBe(5);
	});
});

describe('formatClock', () => {
	it('formats minutes and seconds', () => {
		expect(formatClock(0)).toBe('0:00');
		expect(formatClock(65.9)).toBe('1:05');
	});
});
