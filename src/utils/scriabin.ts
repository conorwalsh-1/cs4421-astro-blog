// Music helpers for the interactive pieces of the site: note frequencies,
// Scriabin's colour-key associations and the "Mystic" (Prometheus) chord.

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type PitchClass = (typeof PITCH_CLASSES)[number];

// Scriabin's synaesthetic key colours, as notated for the "luce" (light)
// part of Prometheus: The Poem of Fire, Op. 60.
export const SCRIABIN_COLOURS: Record<PitchClass, { hex: string; name: string }> = {
	C: { hex: '#ff0000', name: 'red' },
	'C#': { hex: '#9000ff', name: 'violet' },
	D: { hex: '#ffff00', name: 'yellow' },
	'D#': { hex: '#b7468b', name: 'flesh, with a steely sheen' },
	E: { hex: '#c3f2ff', name: 'pearly white-blue' },
	F: { hex: '#ab0034', name: 'deep red' },
	'F#': { hex: '#7f8bfd', name: 'bright blue' },
	G: { hex: '#ff8000', name: 'orange-pink' },
	'G#': { hex: '#bb75fc', name: 'purple-violet' },
	A: { hex: '#33cc33', name: 'green' },
	'A#': { hex: '#a9677c', name: 'steel, with a metallic sheen' },
	B: { hex: '#8ec9ff', name: 'pale blue' },
};

// Intervals (in semitones above the root) of the Mystic chord: C F# Bb E A D.
export const MYSTIC_CHORD_INTERVALS = [0, 6, 10, 16, 21, 26] as const;

/** Frequency in Hz of a MIDI note number, using equal temperament at A4 = 440 Hz. */
export function midiToFrequency(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

/** Pitch class (e.g. "F#") of a MIDI note number. */
export function pitchClassOf(midi: number): PitchClass {
	return PITCH_CLASSES[((midi % 12) + 12) % 12];
}

/** Scientific pitch name of a MIDI note number, e.g. 60 -> "C4". */
export function noteName(midi: number): string {
	return `${pitchClassOf(midi)}${Math.floor(midi / 12) - 1}`;
}

/** Scriabin's colour for the given MIDI note. */
export function colourOf(midi: number): string {
	return SCRIABIN_COLOURS[pitchClassOf(midi)].hex;
}

/** MIDI notes of the Mystic chord built on the given root. */
export function mysticChord(rootMidi: number): number[] {
	return MYSTIC_CHORD_INTERVALS.map((interval) => rootMidi + interval);
}
