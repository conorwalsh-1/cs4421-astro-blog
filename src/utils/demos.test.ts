import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMOS } from './demos';
import { PIANO_HIGHEST, PIANO_LOWEST } from './keymap';
import { mysticChord, noteName } from './scriabin';

const composerIds = readdirSync('src/content/composers')
	.filter((file) => file.endsWith('.md'))
	.map((file) => file.replace(/\.md$/, ''))
	.sort();

const pitchClasses = (midis: number[]) => new Set(midis.map((midi) => midi % 12));

describe('composer demos', () => {
	it('exist for exactly the composers in the content collection', () => {
		expect(Object.keys(DEMOS).sort()).toEqual(composerIds);
		expect(composerIds).toHaveLength(7);
	});

	describe.each(Object.entries(DEMOS))('%s', (_, demo) => {
		const { notes } = demo.score;

		it('only uses keys that exist on an 88-key piano', () => {
			for (const note of notes) {
				expect(note.midi).toBeGreaterThanOrEqual(PIANO_LOWEST);
				expect(note.midi).toBeLessThanOrEqual(PIANO_HIGHEST);
			}
		});

		it('has sorted notes with positive lengths and sensible loudness', () => {
			notes.forEach((note, i) => {
				expect(note.duration).toBeGreaterThan(0);
				expect(note.velocity).toBeGreaterThan(0);
				expect(note.velocity).toBeLessThanOrEqual(1);
				if (i > 0) expect(note.time).toBeGreaterThanOrEqual(notes[i - 1].time);
			});
		});

		it('never re-strikes a key that is still sounding', () => {
			const lastEnd = new Map<number, number>();
			for (const note of notes) {
				expect(note.time + 1e-9).toBeGreaterThanOrEqual(lastEnd.get(note.midi) ?? -Infinity);
				lastEnd.set(note.midi, note.time + note.duration);
			}
		});

		it('is short enough to listen to on a profile page', () => {
			expect(demo.score.duration).toBeGreaterThan(3);
			expect(demo.score.duration).toBeLessThan(20);
		});

		it('says clearly whether it quotes the composer', () => {
			if (!demo.quotation) expect(demo.description).toContain('not a quotation');
		});
	});

	it('only quotes public-domain sources: Bach, Mozart and Scriabin', () => {
		expect(
			Object.entries(DEMOS)
				.filter(([, demo]) => demo.quotation)
				.map(([id]) => id)
				.sort(),
		).toEqual(['bach', 'mozart', 'scriabin']);
	});
});

describe('quotations are exact', () => {
	it('Bach BWV 846: bar 1 is C E G C E G C E, played twice, over held C and E', () => {
		const bar1 = DEMOS.bach.score.notes.filter((n) => n.time < (60 / 72) * 4 - 1e-9);
		expect(bar1.slice(0, 8).map((n) => noteName(n.midi))).toEqual(['C4', 'E4', 'G4', 'C5', 'E5', 'G4', 'C5', 'E5']);
		expect(bar1).toHaveLength(16);
		expect(bar1[0].duration).toBeCloseTo((60 / 72) * 2); // the bass is held for half a bar
	});

	it('Bach BWV 846: bars 2–4 follow the harmony of the original', () => {
		const beat = 60 / 72;
		const barPitches = (bar: number) =>
			[
				...new Set(
					DEMOS.bach.score.notes
						.filter((n) => n.time >= bar * 4 * beat - 1e-9 && n.time < (bar + 1) * 4 * beat - 1e-9)
						.map((n) => noteName(n.midi)),
				),
			].sort();
		expect(barPitches(1)).toEqual(['A4', 'C4', 'D4', 'D5', 'F5']);
		expect(barPitches(2)).toEqual(['B3', 'D4', 'D5', 'F5', 'G4']);
		expect(barPitches(3)).toEqual(['C4', 'C5', 'E4', 'E5', 'G4']);
	});

	it('Mozart K. 545: melody C–E–G | B–C–D–C over an Alberti bass', () => {
		const melody = DEMOS.mozart.score.notes.filter((n) => n.velocity === 0.75).map((n) => noteName(n.midi));
		const bass = DEMOS.mozart.score.notes.filter((n) => n.velocity !== 0.75).map((n) => noteName(n.midi));
		expect(melody).toEqual(['C5', 'E5', 'G5', 'B4', 'C5', 'D5', 'C5']);
		expect(bass.slice(0, 8)).toEqual(['C4', 'G4', 'E4', 'G4', 'C4', 'G4', 'E4', 'G4']);
		expect(bass.slice(8, 12)).toEqual(['D4', 'G4', 'F4', 'G4']);
	});

	it('Scriabin: the Mystic chord on C, then the Prometheus scale', () => {
		const midis = DEMOS.scriabin.score.notes.map((n) => n.midi);
		expect(midis.slice(0, 6)).toEqual(mysticChord(60));
		expect(midis.slice(6).map(noteName)).toEqual(['C4', 'D4', 'E4', 'F#4', 'A4', 'A#4', 'C5']);
	});
});

describe('original sketches stay in their keys', () => {
	it('Chopin sketch: E-flat major (plus one chromatic E natural)', () => {
		const allowed = new Set([3, 5, 7, 8, 10, 0, 2, 4]);
		for (const pc of pitchClasses(DEMOS.chopin.score.notes.map((n) => n.midi))) expect(allowed).toContain(pc);
		expect(noteName(Math.min(...DEMOS.chopin.score.notes.map((n) => n.midi)))).toBe('G#1'); // A-flat 1
	});

	it('Liszt sketch: ends on a D minor chord', () => {
		const { notes, duration } = DEMOS.liszt.score;
		const final = notes.filter((n) => n.time + n.duration >= duration - 1e-9).map((n) => n.midi);
		expect(pitchClasses(final)).toEqual(new Set([2, 5, 9]));
	});

	it('Ravel sketch: ends on E major', () => {
		const { notes, duration } = DEMOS.ravel.score;
		const final = notes.filter((n) => n.time + n.duration >= duration - 1e-9).map((n) => n.midi);
		expect(pitchClasses(final)).toEqual(new Set([4]));
	});

	it('Hamelin sketch: reaches both ends of the piano', () => {
		const midis = DEMOS.hamelin.score.notes.map((n) => n.midi);
		expect(Math.min(...midis)).toBe(PIANO_LOWEST);
		expect(Math.max(...midis)).toBe(PIANO_HIGHEST);
	});
});
