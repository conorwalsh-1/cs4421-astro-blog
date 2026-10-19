// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { looksLikeMusicXml, MusicXmlParseError, parseMusicXml } from './musicxml';

/** Wraps measures in a minimal one-part score-partwise document. */
const score = (measures: string, header = '') => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  ${header}
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">${measures}</part>
</score-partwise>`;

const note = (step: string, octave: number, duration: number, extra = '') =>
	`<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration>${extra}</note>`;

const times = (xml: string) =>
	parseMusicXml(xml).notes.map(({ midi, time, duration }) => ({ midi, time, duration }));

describe('looksLikeMusicXml', () => {
	it('detects partwise and timewise scores', () => {
		expect(looksLikeMusicXml(score(''))).toBe(true);
		expect(looksLikeMusicXml('<html></html>')).toBe(false);
	});
});

describe('parseMusicXml', () => {
	it('reads pitches and durations at the default 120 bpm', () => {
		const xml = score(`<measure number="1">
			<attributes><divisions>2</divisions></attributes>
			${note('C', 4, 2)}${note('E', 4, 1)}${note('G', 4, 1)}
		</measure>`);

		expect(times(xml)).toEqual([
			{ midi: 60, time: 0, duration: 0.5 },
			{ midi: 64, time: 0.5, duration: 0.25 },
			{ midi: 67, time: 0.75, duration: 0.25 },
		]);
		expect(parseMusicXml(xml).format).toBe('MusicXML');
	});

	it('applies sharps and flats with <alter>', () => {
		const xml = score(`<measure>
			<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration></note>
			<note><pitch><step>B</step><alter>-1</alter><octave>3</octave></pitch><duration>1</duration></note>
		</measure>`);
		expect(parseMusicXml(xml).notes.map((n) => n.midi)).toEqual([66, 58]); // F#4 then Bb3
	});

	it('stacks <chord/> notes on the previous note', () => {
		const xml = score(`<measure>
			${note('C', 4, 1)}${note('E', 4, 1, '<chord/>')}${note('G', 4, 1, '<chord/>')}${note('D', 4, 1)}
		</measure>`);
		expect(times(xml).map((n) => [n.midi, n.time])).toEqual([
			[60, 0],
			[64, 0],
			[67, 0],
			[62, 0.5],
		]);
	});

	it('advances time over rests and handles <backup> / <forward> voices', () => {
		const xml = score(`<measure>
			<attributes><divisions>1</divisions></attributes>
			${note('E', 5, 2)}
			<note><rest/><duration>2</duration></note>
			<backup><duration>4</duration></backup>
			<forward><duration>1</duration></forward>
			${note('C', 3, 3)}
		</measure>`);
		expect(times(xml)).toEqual([
			{ midi: 48, time: 0.5, duration: 1.5 },
			{ midi: 76, time: 0, duration: 1 },
		].sort((a, b) => a.time - b.time));
	});

	it('joins tied notes into one longer note', () => {
		const xml = score(`<measure>
			${note('A', 4, 2, '<tie type="start"/>')}
		</measure><measure>
			${note('A', 4, 1, '<tie type="stop"/>')}${note('B', 4, 1)}
		</measure>`);
		expect(times(xml)).toEqual([
			{ midi: 69, time: 0, duration: 1.5 },
			{ midi: 71, time: 1.5, duration: 0.5 },
		]);
	});

	it('follows tempo markings from <sound tempo> and <metronome>', () => {
		const xml = score(`<measure>
			<direction><sound tempo="60"/></direction>
			${note('C', 4, 1)}
			<direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>
			${note('D', 4, 1)}${note('E', 4, 1)}
		</measure>`);
		// One beat at 60 bpm, then 120 quarter notes per minute.
		expect(times(xml).map((n) => n.time)).toEqual([0, 1, 1.5]);
	});

	it('supports dotted metronome units', () => {
		const xml = score(`<measure>
			<direction><direction-type><metronome><beat-unit>quarter</beat-unit><beat-unit-dot/><per-minute>40</per-minute></metronome></direction-type></direction>
			${note('C', 4, 1)}${note('D', 4, 1)}
		</measure>`);
		expect(times(xml)[1].time).toBeCloseTo(1);
	});

	it('uses dynamics markings for loudness', () => {
		const xml = score(`<measure>
			<direction><sound dynamics="50"/></direction>
			${note('C', 4, 1)}
			<note dynamics="100"><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
		</measure>`);
		const [soft, loud] = parseMusicXml(xml).notes;
		expect(soft.velocity).toBeCloseTo(0.5 * (90 / 127));
		expect(loud.velocity).toBeCloseTo(90 / 127);
	});

	it('skips grace notes and unpitched notes', () => {
		const xml = score(`<measure>
			<note><grace/><pitch><step>B</step><octave>4</octave></pitch></note>
			<note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>
			${note('C', 5, 1)}
		</measure>`);
		expect(times(xml)).toEqual([{ midi: 72, time: 0.5, duration: 0.5 }]);
	});

	it('combines several parts that play at the same time', () => {
		const xml = `<score-partwise>
			<part-list><score-part id="P1"/><score-part id="P2"/></part-list>
			<part id="P1"><measure>${note('C', 5, 1)}</measure></part>
			<part id="P2"><measure>${note('C', 3, 1)}</measure></part>
		</score-partwise>`;
		expect(times(xml).map((n) => [n.midi, n.time])).toEqual([
			[48, 0],
			[72, 0],
		]);
	});

	it('reads the title from <work-title>, then <movement-title>, then the fallback', () => {
		expect(parseMusicXml(score('', '<work><work-title>Vers la flamme</work-title></work>')).title).toBe(
			'Vers la flamme',
		);
		expect(parseMusicXml(score('', '<movement-title>Prelude</movement-title>')).title).toBe('Prelude');
		expect(parseMusicXml(score(''), 'my score').title).toBe('my score');
	});

	it('rejects invalid XML, other documents and timewise scores', () => {
		expect(() => parseMusicXml('<score-partwise><part>')).toThrow(MusicXmlParseError);
		expect(() => parseMusicXml('<html></html>')).toThrow(/Not a MusicXML score/);
		expect(() => parseMusicXml('<score-timewise></score-timewise>')).toThrow(/timewise/);
	});
});
