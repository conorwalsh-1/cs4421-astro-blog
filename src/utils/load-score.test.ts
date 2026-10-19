// @vitest-environment happy-dom
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { loadScore, UnsupportedScoreError } from './load-score';
import { MxlError, unzipMxl } from './mxl';

const MUSICXML = `<?xml version="1.0"?>
<score-partwise><work><work-title>Mystic study</work-title></work>
<part-list><score-part id="P1"/></part-list>
<part id="P1"><measure>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
<note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration></note>
</measure></part></score-partwise>`;

const CONTAINER = `<?xml version="1.0"?><container><rootfiles>
<rootfile full-path="score/study.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
</rootfiles></container>`;

/** Builds a zip archive (deflated or stored entries) like an .mxl export. */
function zip(files: Record<string, string>, method: 0 | 8 = 8): Uint8Array {
	const encoder = new TextEncoder();
	const local: number[] = [];
	const central: number[] = [];
	const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
	const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

	for (const [name, text] of Object.entries(files)) {
		const nameBytes = [...encoder.encode(name)];
		const raw = encoder.encode(text);
		const data = [...(method === 8 ? deflateRawSync(raw) : raw)];
		const offset = local.length;
		local.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(method), ...u32(0), ...u32(0));
		local.push(...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes, ...data);
		central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(method), ...u32(0), ...u32(0));
		central.push(...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...u16(0));
		central.push(...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes);
	}
	const count = Object.keys(files).length;
	const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count)];
	end.push(...u32(central.length), ...u32(local.length), ...u16(0));
	return new Uint8Array([...local, ...central, ...end]);
}

const midiBytes = new Uint8Array([
	...[0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0],
	...[0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 13],
	...[0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0, 0xff, 0x2f, 0],
]);

describe('loadScore', () => {
	it('detects MIDI files by their header', async () => {
		const score = await loadScore('prelude_op11-no1.mid', midiBytes);
		expect(score.format).toBe('MIDI');
		expect(score.title).toBe('prelude op11 no1');
		expect(score.notes).toHaveLength(1);
	});

	it('detects uncompressed MusicXML', async () => {
		const score = await loadScore('study.musicxml', new TextEncoder().encode(MUSICXML));
		expect(score.format).toBe('MusicXML');
		expect(score.title).toBe('Mystic study');
		expect(score.notes.map((n) => n.midi)).toEqual([60, 66]);
	});

	it('opens compressed .mxl files using container.xml', async () => {
		const bytes = zip({ 'META-INF/container.xml': CONTAINER, 'score/study.musicxml': MUSICXML });
		const score = await loadScore('study.mxl', bytes);
		expect(score.notes.map((n) => n.midi)).toEqual([60, 66]);
	});

	it('explains that PDFs and images cannot be read', async () => {
		await expect(loadScore('prelude.pdf', new TextEncoder().encode('%PDF-1.7'))).rejects.toThrow(/MusicXML/);
		await expect(loadScore('notes.txt', new TextEncoder().encode('hello'))).rejects.toThrow(UnsupportedScoreError);
	});
});

describe('unzipMxl', () => {
	it('falls back to the first .musicxml entry without a container', async () => {
		expect(await unzipMxl(zip({ 'study.musicxml': MUSICXML }))).toBe(MUSICXML);
	});

	it('reads stored (uncompressed) entries', async () => {
		expect(await unzipMxl(zip({ 'study.xml': MUSICXML }, 0))).toBe(MUSICXML);
	});

	it('rejects archives without a score or that are not zips', async () => {
		await expect(unzipMxl(zip({ 'readme.txt': 'hi' }))).rejects.toThrow(MxlError);
		await expect(unzipMxl(new Uint8Array(40))).rejects.toThrow(/Not a valid/);
	});
});
