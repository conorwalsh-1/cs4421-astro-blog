// Short pieces each composer page plays on the visual piano.
// Bach and Mozart are exact public-domain openings; Scriabin is his Mystic chord
// and Prometheus scale. The others are ORIGINAL sketches in each composer's style,
// labelled as such, never presented as quotations.

import { finishScore, type Score, type ScoreNote } from './score';
import { mysticChord } from './scriabin';

export interface Demo {
	title: string;
	description: string;
	/** True when the notes are taken from the composer's own work. */
	quotation: boolean;
	score: Score;
}

/** [midi, start beat, length in beats, velocity 0–1] */
type BeatNote = [number, number, number, number?];

function fromBeats(title: string, bpm: number, notes: BeatNote[]): Score {
	const beat = 60 / bpm;
	return finishScore(
		title,
		'MIDI',
		notes.map(([midi, start, length, velocity = 0.7]): ScoreNote => ({
			midi,
			time: start * beat,
			duration: length * beat,
			velocity,
		})),
	);
}

// --- Bach: Prelude in C major, BWV 846, bars 1–4 ------------------------------------
// Each half bar: the bass note is held, the second note enters a sixteenth later and is
// held, and the top three notes are played twice as sixteenths.
function bach(): Score {
	const bars = [
		[60, 64, 67, 72, 76], // C
		[60, 62, 69, 74, 77], // Dm7/C
		[59, 62, 67, 74, 77], // G7/B
		[60, 64, 67, 72, 76], // C
	];
	const notes: BeatNote[] = [];
	bars.forEach((chord, bar) => {
		for (let half = 0; half < 2; half++) {
			const start = bar * 4 + half * 2;
			const [bass, tenor, ...upper] = chord;
			notes.push([bass, start, 2, 0.6], [tenor, start + 0.25, 1.75, 0.55]);
			[...upper, ...upper].forEach((midi, i) => notes.push([midi, start + 0.5 + i * 0.25, 0.25, 0.62]));
		}
	});
	return fromBeats('Prelude in C major, BWV 846', 72, notes);
}

// --- Mozart: Piano Sonata in C major, K. 545, first movement, bars 1–2 --------------
function mozart(): Score {
	const melody: BeatNote[] = [
		[72, 0, 2], // C5
		[76, 2, 1], // E5
		[79, 3, 1], // G5
		[71, 4, 1.5], // B4
		[72, 5.5, 0.25], // C5
		[74, 5.75, 0.25], // D5
		[72, 6, 2], // C5
	].map(([midi, start, length]) => [midi, start, length, 0.75]);
	// Alberti bass in eighths: C G E G | D G F G, C G E G.
	const alberti = [60, 67, 64, 67, 60, 67, 64, 67, 62, 67, 65, 67, 60, 67, 64, 67];
	const bass: BeatNote[] = alberti.map((midi, i) => [midi, i * 0.5, 0.5, 0.42]);
	return fromBeats('Piano Sonata in C major, K. 545', 120, [...melody, ...bass]);
}

// --- Chopin (original sketch): nocturne style in E-flat major -----------------------
function chopin(): Score {
	const harmonies = [
		[39, 46, 55, 63, 55, 46], // E-flat: Eb2 Bb2 G3 Eb4 G3 Bb2
		[32, 39, 48, 56, 48, 39], // A-flat: Ab1 Eb2 C3 Ab3 C3 Eb2
		[34, 41, 50, 56, 50, 41], // B-flat 7: Bb1 F2 D3 Ab3 D3 F2
	];
	const notes: BeatNote[] = [];
	harmonies.forEach((pattern, bar) => {
		// Two sweeps of six triplet eighths per bar, ringing under the pedal.
		for (let i = 0; i < 12; i++) notes.push([pattern[i % 6], bar * 4 + i / 3, 0.6, 0.38]);
	});
	notes.push([39, 12, 3, 0.4], [46, 12.08, 3, 0.38], [55, 12.16, 3, 0.36], [63, 12.24, 3, 0.36]); // rolled Eb chord
	const melody: BeatNote[] = [
		[79, 0, 1.5], // G5
		[77, 1.5, 0.5], // F5
		[75, 2, 1], // Eb5
		[70, 3, 1], // Bb4
		[72, 4, 1.5], // C5
		[75, 5.5, 0.5], // Eb5
		[80, 6, 1.5], // Ab5
		[79, 7.5, 0.5], // G5
		[77, 8, 1], // F5, then a turn
		[79, 9, 0.25], // G5
		[77, 9.25, 0.25], // F5
		[76, 9.5, 0.25], // E natural, a chromatic neighbour
		[77, 9.75, 0.25], // F5
		[80, 10, 1], // Ab5
		[74, 11, 1], // D5
		[75, 12, 3], // Eb5
	].map(([midi, start, length]) => [midi, start, length, 0.72]);
	return fromBeats('Nocturne sketch in E-flat (original, in the style of Chopin)', 66, [...notes, ...melody]);
}

// --- Liszt (original sketch): octaves, tremolo storm and cadenza in D minor ---------
function liszt(): Score {
	const notes: BeatNote[] = [];
	// Thundering octaves in both hands, descending chromatically.
	[0, -1, -2, -3, -4, -5, -6, -5].forEach((step, i) => {
		const start = i * 0.5;
		for (const midi of [74 + step, 86 + step, 38 + step, 50 + step]) notes.push([midi, start, 0.45, 0.95]);
	});
	// Tremolo storm under a held D minor chord.
	for (let i = 0; i < 16; i++) notes.push([i % 2 === 0 ? 38 : 45, 4 + i * 0.125, 0.125, 0.8]);
	notes.push([74, 4, 2, 0.75], [77, 4, 2, 0.75], [81, 4, 2, 0.75]);
	// Sweeping cadenza: the D harmonic-minor scale from D4 up to D7.
	const scale = [0, 2, 3, 5, 7, 8, 11];
	const cadenza = Array.from({ length: 22 }, (_, i) => 62 + 12 * Math.floor(i / 7) + scale[i % 7]);
	cadenza.forEach((midi, i) => notes.push([midi, 6 + i * 0.09, 0.09, 0.6 + 0.35 * (i / cadenza.length)]));
	// Final D minor chord across the whole keyboard.
	for (const midi of [26, 38, 50, 74, 77, 81, 86]) notes.push([midi, 8.2, 2.5, 1]);
	return fromBeats('Octave storm (original, in the style of Liszt)', 120, notes);
}

// --- Scriabin: the Mystic chord, then the Prometheus scale --------------------------
function scriabin(): Score {
	const notes: BeatNote[] = mysticChord(60).map((midi, i) => [midi, i * 0.09, 2.5, 0.7]);
	[0, 2, 4, 6, 9, 10, 12].forEach((step, i) => notes.push([60 + step, 3 + i * 0.3, 0.3, 0.65]));
	return fromBeats('The Mystic chord and the Prometheus scale', 60, notes);
}

// --- Ravel (original sketch): rippling water-music arpeggios in E major -------------
function ravel(): Score {
	const chords = [
		[64, 68, 71, 75, 78], // Emaj9: E G# B D# F#
		[61, 64, 68, 71, 78], // C#m11: C# E G# B F#
		[57, 61, 64, 68, 75], // Amaj7#11 colour: A C# E G# D#
		[59, 64, 66, 69, 73], // Bsus: B E F# A C#
	];
	const basses = [40, 37, 33, 35];
	const notes: BeatNote[] = [];
	chords.forEach((chord, c) => {
		const start = c * 2;
		const sweep = [...chord, ...chord.slice(0, 3).map((midi) => midi + 12)];
		sweep.forEach((midi, i) => notes.push([midi, start + i * 0.25, 0.5, 0.45 + 0.04 * i]));
		notes.push([basses[c], start, 2, 0.5]);
	});
	// A final sparkle at the top of the keyboard over a low E.
	for (const [midi, offset] of [
		[88, 0],
		[92, 0.08],
		[95, 0.16],
		[100, 0.24],
	]) {
		notes.push([midi, 8 + offset, 2.5, 0.5]);
	}
	notes.push([28, 8, 3, 0.45]);
	return fromBeats('Water-music sketch (original, in the style of Ravel)', 100, notes);
}

// --- Hamelin (original sketch): modern virtuoso textures ----------------------------
function hamelin(): Score {
	const notes: BeatNote[] = [];
	// Three against four: left-hand triplets against right-hand sixteenths.
	for (let i = 0; i < 12; i++) notes.push([[36, 43, 50][i % 3], i / 3, 1 / 3, 0.6]);
	for (let i = 0; i < 16; i++) notes.push([[72, 73, 79, 78][i % 4], i * 0.25, 0.25, 0.62]);
	// Leaps between the far ends of the keyboard.
	[96, 30, 95, 31, 94, 32, 93, 33].forEach((midi, i) => notes.push([midi, 4 + i * 0.25, 0.22, 0.8]));
	// Dense chromatic clusters, then A0 and C8 together: the full range of the piano.
	for (const midi of [77, 78, 83, 84, 89, 25, 32, 37]) notes.push([midi, 6.25, 0.5, 0.85]);
	for (const midi of [70, 71, 76, 77, 82, 23, 30, 35]) notes.push([midi, 7, 0.5, 0.85]);
	for (const midi of [21, 33, 57, 93, 108]) notes.push([midi, 7.75, 2, 1]);
	return fromBeats('Polyrhythm and leaps (original, in a modern virtuoso style)', 72, notes);
}

export const DEMOS: Record<string, Demo> = {
	bach: {
		title: 'Prelude in C major, BWV 846: bars 1–4',
		description:
			'The opening of The Well-Tempered Clavier, Book I. One broken chord per bar, each played twice, with the lowest two notes held.',
		quotation: true,
		score: bach(),
	},
	mozart: {
		title: 'Piano Sonata in C major, K. 545: bars 1–2',
		description: 'The opening melody over an Alberti bass, the left hand breaking each chord into a lilting pattern.',
		quotation: true,
		score: mozart(),
	},
	chopin: {
		title: 'Nocturne sketch in E-flat major',
		description:
			"An original sketch in Chopin's nocturne style (not a quotation): a singing melody with a turn, over wide left-hand arpeggios.",
		quotation: false,
		score: chopin(),
	},
	liszt: {
		title: 'Octave storm in D minor',
		description:
			"An original sketch in Liszt's virtuoso style (not a quotation): thundering octaves, a tremolo storm and a sweeping cadenza.",
		quotation: false,
		score: liszt(),
	},
	scriabin: {
		title: 'The Mystic chord and the Prometheus scale',
		description: 'C – F♯ – B♭ – E – A – D, rolled from C, then the same notes arranged as a scale within one octave.',
		quotation: true,
		score: scriabin(),
	},
	ravel: {
		title: 'Water-music sketch in E major',
		description:
			"An original sketch in the style of Ravel's water music (not a quotation): rippling arpeggios on rich seventh and ninth chords.",
		quotation: false,
		score: ravel(),
	},
	hamelin: {
		title: 'Polyrhythm and leaps',
		description:
			'An original sketch in a modern virtuoso style (not a quotation; Hamelin’s works are under copyright): three against four, leaps across the keyboard, and A0 and C8 together.',
		quotation: false,
		score: hamelin(),
	},
};
