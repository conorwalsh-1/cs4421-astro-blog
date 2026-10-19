import { describe, expect, it } from 'vitest';
import { isMidi, MidiParseError, parseMidi } from './midi';

// --- A tiny Standard MIDI File writer for building test fixtures ---------------

const varLength = (value: number): number[] => {
	const bytes = [value & 0x7f];
	while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80);
	return bytes;
};
const uint32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** Each event: [deltaTicks, ...rawBytes]. */
const track = (events: number[][]) => {
	const body = events.flatMap(([delta, ...bytes]) => [...varLength(delta), ...bytes]);
	return [...ascii('MTrk'), ...uint32(body.length), ...body];
};
const midiFile = (format: number, division: number, tracks: number[][]) =>
	new Uint8Array([
		...ascii('MThd'),
		...uint32(6),
		0,
		format,
		0,
		tracks.length,
		(division >> 8) & 0xff,
		division & 0xff,
		...tracks.flat(),
	]);

const tempo = (bpm: number) => {
	const us = Math.round(60_000_000 / bpm);
	return [0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff];
};
const name = (text: string) => [0xff, 0x03, text.length, ...ascii(text)];
const END = [0xff, 0x2f, 0];
const on = (note: number, velocity = 100, channel = 0) => [0x90 | channel, note, velocity];
const off = (note: number, channel = 0) => [0x80 | channel, note, 0];
const pedal = (down: boolean, channel = 0) => [0xb0 | channel, 64, down ? 127 : 0];

// -------------------------------------------------------------------------------

describe('isMidi', () => {
	it('recognises the MThd header', () => {
		expect(isMidi(midiFile(0, 480, [track([[0, ...END]])]))).toBe(true);
		expect(isMidi(new TextEncoder().encode('<score-partwise>'))).toBe(false);
	});
});

describe('parseMidi', () => {
	it('reads notes at the default 120 bpm', () => {
		const score = parseMidi(
			midiFile(0, 480, [
				track([
					[0, ...on(60)],
					[480, ...off(60)],
					[0, ...on(64, 64)],
					[960, ...off(64)],
					[0, ...END],
				]),
			]),
		);

		expect(score.format).toBe('MIDI');
		expect(score.notes).toEqual([
			{ midi: 60, time: 0, duration: 0.5, velocity: 100 / 127 },
			{ midi: 64, time: 0.5, duration: 1, velocity: 64 / 127 },
		]);
		expect(score.duration).toBe(1.5);
	});

	it('uses the first track name as the title, with a fallback', () => {
		const named = midiFile(0, 480, [track([[0, ...name('Etude in D# minor')], [0, ...END]])]);
		expect(parseMidi(named).title).toBe('Etude in D# minor');
		expect(parseMidi(midiFile(0, 480, [track([[0, ...END]])]), 'upload.mid').title).toBe('upload.mid');
	});

	it('applies tempo changes from the tempo track in format 1 files', () => {
		const score = parseMidi(
			midiFile(1, 480, [
				track([[0, ...tempo(60)], [960, ...tempo(120)], [0, ...END]]),
				track([
					[0, ...on(60)],
					[480, ...off(60)],
					[480, ...on(62)],
					[480, ...off(62)],
					[0, ...END],
				]),
			]),
		);

		// Two beats at 60 bpm (2 s), then one beat at 120 bpm (0.5 s).
		expect(score.notes.map(({ midi, time, duration }) => ({ midi, time, duration }))).toEqual([
			{ midi: 60, time: 0, duration: 1 },
			{ midi: 62, time: 2, duration: 0.5 },
		]);
	});

	it('supports running status and note-on with velocity 0 as note-off', () => {
		const score = parseMidi(
			midiFile(0, 96, [
				track([
					[0, 0x90, 60, 90],
					[0, 64, 90], // running status: another note-on
					[96, 60, 0], // note-off via velocity 0
					[0, 64, 0],
					[0, ...END],
				]),
			]),
		);
		expect(score.notes.map((n) => [n.midi, n.duration])).toEqual([
			[60, 0.5],
			[64, 0.5],
		]);
	});

	it('holds released notes until the sustain pedal is lifted', () => {
		const score = parseMidi(
			midiFile(0, 480, [
				track([
					[0, ...pedal(true)],
					[0, ...on(48)],
					[240, ...off(48)], // released under the pedal
					[720, ...pedal(false)], // pedal up after 2 beats in total
					[0, ...END],
				]),
			]),
		);
		expect(score.notes[0]).toMatchObject({ midi: 48, time: 0, duration: 1 });
	});

	it('ends a pedalled note when the same key is struck again', () => {
		const score = parseMidi(
			midiFile(0, 480, [
				track([
					[0, ...pedal(true)],
					[0, ...on(60)],
					[240, ...off(60)],
					[240, ...on(60)],
					[480, ...off(60)],
					[0, ...pedal(false)],
					[0, ...END],
				]),
			]),
		);
		expect(score.notes.map((n) => [n.time, n.duration])).toEqual([
			[0, 0.5],
			[0.5, 0.5],
		]);
	});

	it('skips percussion on channel 10 and ignores other controllers, programs and SysEx', () => {
		const score = parseMidi(
			midiFile(0, 480, [
				track([
					[0, 0xc0, 0], // program change
					[0, 0xb0, 7, 100], // volume controller
					[0, 0xf0, 2, 0x7e, 0xf7], // SysEx
					[0, 0xe0, 0, 64], // pitch bend
					[0, ...on(36, 100, 9)],
					[0, ...on(60)],
					[480, ...off(36, 9)],
					[0, ...off(60)],
					[0, ...END],
				]),
			]),
		);
		expect(score.notes.map((n) => n.midi)).toEqual([60]);
	});

	it('ends notes that are never released at the end of the track', () => {
		const score = parseMidi(midiFile(0, 480, [track([[0, ...on(60)], [960, ...END]])]));
		expect(score.notes[0].duration).toBe(1);
	});

	it('supports SMPTE time division', () => {
		// 25 fps × 40 ticks per frame = 1000 ticks per second.
		const division = ((-25 & 0xff) << 8) | 40;
		const score = parseMidi(midiFile(0, division, [track([[0, ...on(60)], [500, ...off(60)], [0, ...END]])]));
		expect(score.notes[0].duration).toBeCloseTo(0.5);
	});

	it('rejects files that are not MIDI or use unsupported formats', () => {
		expect(() => parseMidi(new Uint8Array([1, 2, 3, 4]))).toThrow(MidiParseError);
		expect(() => parseMidi(midiFile(2, 480, [track([[0, ...END]])]))).toThrow(/format 2/);
	});

	it('reports truncated files instead of hanging', () => {
		const bytes = midiFile(0, 480, [track([[0, ...on(60)], [480, ...off(60)], [0, ...END]])]);
		expect(() => parseMidi(bytes.subarray(0, bytes.length - 6))).toThrow(MidiParseError);
	});
});
