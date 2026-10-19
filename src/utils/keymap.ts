// Computer-keyboard → piano mapping. The home row plays the white keys and the
// row above plays the black keys, starting from C of the selected octave:
//
//    W E   T Y U   O P
//   A S D F G H J K L ;
//   C D E F G A B C D E

export const PIANO_LOWEST = 21; // A0
export const PIANO_HIGHEST = 108; // C8

export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 7;
export const DEFAULT_OCTAVE = 4; // A = middle C (C4)

/** Shift the mapped range down / up an octave. */
export const OCTAVE_DOWN_KEY = 'z';
export const OCTAVE_UP_KEY = 'x';

/** Keys in order of the semitone they play above C of the selected octave. */
export const KEY_LAYOUT = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';'] as const;

/** MIDI number of C in the given octave (C4 = 60). */
export function octaveRoot(octave: number): number {
	return (octave + 1) * 12;
}

export function clampOctave(octave: number): number {
	return Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, octave));
}

/** Note played by a computer key in the given octave, or undefined if unmapped or off the piano. */
export function midiForKey(key: string, octave: number): number | undefined {
	const offset = KEY_LAYOUT.indexOf(key.toLowerCase() as (typeof KEY_LAYOUT)[number]);
	if (offset === -1) return undefined;
	const midi = octaveRoot(octave) + offset;
	return midi >= PIANO_LOWEST && midi <= PIANO_HIGHEST ? midi : undefined;
}

/** Computer key that plays the given note in the given octave, if any. */
export function keyForMidi(midi: number, octave: number): string | undefined {
	return KEY_LAYOUT[midi - octaveRoot(octave)];
}

/** Lowest and highest notes the computer keys currently reach (clipped to the piano). */
export function mappedRange(octave: number): { low: number; high: number } {
	const root = octaveRoot(octave);
	return {
		low: Math.max(PIANO_LOWEST, root),
		high: Math.min(PIANO_HIGHEST, root + KEY_LAYOUT.length - 1),
	};
}
