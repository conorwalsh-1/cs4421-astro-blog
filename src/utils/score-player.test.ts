import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Score } from './score';
import { LOOKAHEAD_SECONDS, ScorePlayer, TICK_MS, type PlayerOutput } from './score-player';

const score: Score = {
	title: 'Test',
	format: 'MIDI',
	duration: 3,
	notes: [
		{ midi: 60, time: 0, duration: 1, velocity: 0.8 },
		{ midi: 64, time: 0, duration: 0.5, velocity: 0.8 },
		{ midi: 67, time: 1, duration: 1, velocity: 0.5 },
		{ midi: 72, time: 2, duration: 1, velocity: 1 },
	],
};

let clock = 100;

function fakeOutput() {
	const output = {
		now: () => clock,
		playNote: vi.fn<PlayerOutput['playNote']>(),
		lightNotes: vi.fn<PlayerOutput['lightNotes']>(),
		silence: vi.fn(),
		onProgress: vi.fn<NonNullable<PlayerOutput['onProgress']>>(),
		onStateChange: vi.fn<NonNullable<PlayerOutput['onStateChange']>>(),
	};
	return output;
}

/** Advance both the audio clock and the timers. */
function advance(seconds: number) {
	const steps = Math.round((seconds * 1000) / TICK_MS);
	for (let i = 0; i < steps; i++) {
		clock += TICK_MS / 1000;
		vi.advanceTimersByTime(TICK_MS);
	}
}

beforeEach(() => {
	vi.useFakeTimers();
	clock = 100;
});
afterEach(() => vi.useRealTimers());

describe('ScorePlayer', () => {
	it('schedules only the notes inside the look-ahead window', () => {
		const output = fakeOutput();
		new ScorePlayer(score, output).play();

		expect(output.playNote.mock.calls.map(([midi]) => midi)).toEqual([60, 64]);
		expect(output.playNote).toHaveBeenCalledWith(60, 100, 0.8, 1);
		expect(output.lightNotes).toHaveBeenCalledWith([60, 64], 0, 1);
		expect(output.onStateChange).toHaveBeenLastCalledWith('playing');
	});

	it('schedules later notes at the right audio-clock time as playback advances', () => {
		const output = fakeOutput();
		new ScorePlayer(score, output).play();

		advance(1 - LOOKAHEAD_SECONDS + 0.05);
		const call = output.playNote.mock.calls.find(([midi]) => midi === 67);
		expect(call?.[1]).toBeCloseTo(101); // clock 100 + 1 s into the score
	});

	it('stops by itself at the end of the score', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.play();
		advance(3.2);

		expect(output.playNote).toHaveBeenCalledTimes(4);
		expect(player.playbackState).toBe('stopped');
		expect(output.onStateChange).toHaveBeenLastCalledWith('stopped');
	});

	it('pauses, silences and resumes from the same position without replaying notes', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.play();
		advance(0.5);
		player.pause();

		expect(output.silence).toHaveBeenCalled();
		expect(player.position).toBeCloseTo(0.5);
		advance(5); // time passes while paused
		expect(player.position).toBeCloseTo(0.5);

		output.playNote.mockClear();
		player.play();
		expect(output.playNote.mock.calls.map(([midi]) => midi)).not.toContain(60);
		advance(0.6);
		expect(output.playNote.mock.calls.map(([midi]) => midi)).toContain(67);
	});

	it('plays faster at a higher speed', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.setSpeed(2);
		player.play();

		expect(output.playNote).toHaveBeenCalledWith(60, 100, 0.8, 0.5);
		advance(0.5);
		expect(player.position).toBeCloseTo(1);
		const call = output.playNote.mock.calls.find(([midi]) => midi === 67);
		expect(call?.[1]).toBeCloseTo(100.5);
	});

	it('keeps the position continuous when the speed changes mid-play', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.play();
		advance(1);
		player.setSpeed(0.5);
		expect(player.position).toBeCloseTo(1);
		advance(1);
		expect(player.position).toBeCloseTo(1.5);
		expect(player.playbackSpeed).toBe(0.5);
	});

	it('seeks while stopped and while playing', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.seek(1.5);
		expect(output.onProgress).toHaveBeenLastCalledWith(1.5);

		player.play();
		expect(output.playNote.mock.calls.map(([midi]) => midi)).toEqual([]);
		player.seek(2);
		expect(output.playNote.mock.calls.map(([midi]) => midi)).toEqual([72]);
		player.seek(-4);
		expect(player.position).toBe(0);
	});

	it('stop() rewinds to the start', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.play();
		advance(1);
		player.stop();
		expect(player.position).toBe(0);
		expect(player.playbackState).toBe('stopped');
		expect(output.onProgress).toHaveBeenLastCalledWith(0);
	});

	it('restarts from the beginning after reaching the end', () => {
		const output = fakeOutput();
		const player = new ScorePlayer(score, output);
		player.play();
		advance(3.2);
		output.playNote.mockClear();
		player.play();
		expect(output.playNote.mock.calls.map(([midi]) => midi)).toEqual([60, 64]);
	});

	it('ignores play() on an empty score and invalid speeds', () => {
		const output = fakeOutput();
		const player = new ScorePlayer({ ...score, notes: [], duration: 0 }, output);
		player.play();
		player.setSpeed(0);
		expect(player.playbackState).toBe('stopped');
		expect(player.playbackSpeed).toBe(1);
	});
});
