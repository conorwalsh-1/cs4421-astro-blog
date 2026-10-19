import { describe, expect, it } from 'vitest';
import { colourOf, midiToFrequency, mysticChord, noteName, pitchClassOf } from './scriabin';

describe('midiToFrequency', () => {
	it('tunes A4 to 440 Hz', () => {
		expect(midiToFrequency(69)).toBe(440);
	});

	it('doubles the frequency every octave', () => {
		expect(midiToFrequency(81)).toBe(880);
	});

	it('returns middle C at roughly 261.63 Hz', () => {
		expect(midiToFrequency(60)).toBeCloseTo(261.63, 2);
	});
});

describe('note naming', () => {
	it('names middle C as C4', () => {
		expect(noteName(60)).toBe('C4');
	});

	it('finds the pitch class of a sharp', () => {
		expect(pitchClassOf(66)).toBe('F#');
	});
});

describe('Scriabin colours', () => {
	it('colours C red', () => {
		expect(colourOf(60)).toBe('#ff0000');
	});

	it('gives the same colour to every octave of a note', () => {
		expect(colourOf(57)).toBe(colourOf(69));
	});
});

describe('mysticChord', () => {
	it('builds C F# Bb E A D on C', () => {
		expect(mysticChord(60).map(noteName)).toEqual(['C4', 'F#4', 'A#4', 'E5', 'A5', 'D6']);
	});
});
