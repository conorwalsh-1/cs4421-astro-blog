// @vitest-environment happy-dom
// The demo scores shipped in public/scores/ must load and parse as expected.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScore } from '../../src/utils/load-score';
import { noteName } from '../../src/utils/scriabin';

const load = (file: string) => loadScore(file, new Uint8Array(readFileSync(`public/scores/${file}`)));

describe('demo scores', () => {
	it('mystic-arpeggios.mid sweeps four Mystic chords and ends on a held chord', async () => {
		const score = await load('mystic-arpeggios.mid');
		const pitches = score.notes.map((n) => n.midi);

		expect(score.format).toBe('MIDI');
		expect(score.title).toBe('Mystic chord arpeggios');
		expect(score.notes).toHaveLength(4 * 23 + 8);
		expect(noteName(Math.min(...pitches))).toBe('C2');
		expect(noteName(Math.max(...pitches))).toBe('D7');
		// The sustain pedal lets each arpeggio note ring past its sixteenth.
		expect(score.notes[0].duration).toBeGreaterThan(1);
	});

	it('prometheus-study.musicxml reads both staves, the tie, tempo and dynamics', async () => {
		const score = await load('prometheus-study.musicxml');
		const beat = 60 / 66;

		expect(score.format).toBe('MusicXML');
		expect(score.title).toBe('Prometheus Study');
		expect(score.notes).toHaveLength(19 + 17);

		// The tied D5 (half note + quarter note) sounds once, for three beats.
		const d5 = score.notes.filter((n) => n.midi === 74 && n.time < 4 * beat);
		expect(d5).toHaveLength(1);
		expect(d5[0].time).toBeCloseTo(2 * beat);
		expect(d5[0].duration).toBeCloseTo(3 * beat);

		// p in bar 1, f from bar 5.
		const firstBar = score.notes.find((n) => n.midi === 69)!;
		const fifthBar = score.notes.find((n) => n.time >= 16 * beat - 1e-6)!;
		expect(firstBar.velocity).toBeLessThan(fifthBar.velocity);
		expect(score.duration).toBeCloseTo(24 * beat);
	});
});
