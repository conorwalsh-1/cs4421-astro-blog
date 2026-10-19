import { describe, expect, it } from 'vitest';
import { clampOctave, keyForMidi, mappedRange, midiForKey, octaveRoot } from './keymap';

describe('octaveRoot', () => {
	it('puts C4 at MIDI 60', () => {
		expect(octaveRoot(4)).toBe(60);
	});
});

describe('midiForKey', () => {
	it('maps A to C and W to C# in the selected octave', () => {
		expect(midiForKey('a', 4)).toBe(60);
		expect(midiForKey('w', 4)).toBe(61);
	});

	it('maps ; to E of the next octave', () => {
		expect(midiForKey(';', 4)).toBe(76);
	});

	it('follows the octave shift', () => {
		expect(midiForKey('a', 5)).toBe(72);
		expect(midiForKey('a', 2)).toBe(36);
	});

	it('is case-insensitive', () => {
		expect(midiForKey('A', 4)).toBe(60);
	});

	it('ignores unmapped keys', () => {
		expect(midiForKey('q', 4)).toBeUndefined();
	});

	it('ignores notes below A0 or above C8', () => {
		expect(midiForKey('a', 0)).toBeUndefined(); // C0 is below A0
		expect(midiForKey('h', 0)).toBe(21); // A0
		expect(midiForKey('a', 7)).toBe(96);
		expect(midiForKey('k', 7)).toBe(108); // C8
		expect(midiForKey('o', 7)).toBeUndefined();
	});
});

describe('keyForMidi', () => {
	it('is the inverse of midiForKey', () => {
		expect(keyForMidi(61, 4)).toBe('w');
		expect(keyForMidi(59, 4)).toBeUndefined();
	});
});

describe('clampOctave', () => {
	it('keeps the octave on the piano', () => {
		expect(clampOctave(-1)).toBe(0);
		expect(clampOctave(9)).toBe(7);
		expect(clampOctave(3)).toBe(3);
	});
});

describe('mappedRange', () => {
	it('spans C to E an octave up', () => {
		expect(mappedRange(4)).toEqual({ low: 60, high: 76 });
	});

	it('is clipped at the ends of the piano', () => {
		expect(mappedRange(0)).toEqual({ low: 21, high: 28 });
		expect(mappedRange(7)).toEqual({ low: 96, high: 108 });
	});
});
