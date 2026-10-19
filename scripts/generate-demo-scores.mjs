// Generates the two original demo scores in public/scores/ used by the score player:
//   node scripts/generate-demo-scores.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/scores/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const MYSTIC = [0, 6, 10, 16, 21, 26];

// --- MIDI: Mystic chord arpeggios ------------------------------------------------

const TPQ = 480;
const varLength = (value) => {
	const bytes = [value & 0x7f];
	while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80);
	return bytes;
};
const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const ascii = (text) => [...Buffer.from(text, 'utf8')];

/** Absolute-tick events → MTrk chunk. */
function trackChunk(events) {
	const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
	let last = 0;
	const body = [];
	for (const event of sorted) {
		body.push(...varLength(event.tick - last), ...event.bytes);
		last = event.tick;
	}
	body.push(0, 0xff, 0x2f, 0);
	return [...ascii('MTrk'), ...u32(body.length), ...body];
}

function mysticArpeggios() {
	const events = [];
	let order = 0;
	const add = (tick, bytes) => events.push({ tick, order: order++, bytes });
	const title = ascii('Mystic chord arpeggios');
	add(0, [0xff, 0x03, title.length, ...title]);
	const bpm = 84;
	const us = Math.round(60_000_000 / bpm);
	add(0, [0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]);

	const sixteenth = TPQ / 4;
	let tick = 0;
	// Up in minor thirds: C, E-flat, F-sharp, A — each a sweep over four octaves and back.
	for (const root of [36, 39, 42, 45]) {
		const tones = [...MYSTIC.map((i) => root + i), ...MYSTIC.map((i) => root + 24 + i)];
		const sweep = [...tones, ...tones.slice(0, -1).reverse()];
		add(tick, [0xb0, 64, 127]); // pedal down
		sweep.forEach((midi, i) => {
			const velocity = 60 + Math.round(40 * Math.sin((Math.PI * i) / (sweep.length - 1)));
			add(tick + i * sixteenth, [0x90, midi, velocity]);
			add(tick + (i + 1) * sixteenth, [0x80, midi, 0]);
		});
		tick += sweep.length * sixteenth;
		add(tick - 10, [0xb0, 64, 0]); // pedal up, clearing the harmony
	}
	// Final rolled Mystic chord on C, held under the pedal.
	add(tick, [0xb0, 64, 127]);
	[36, ...MYSTIC.map((i) => 48 + i), 72 + 26].forEach((midi, i) => {
		add(tick + i * 40, [0x90, midi, 70]);
		add(tick + TPQ * 4, [0x80, midi, 0]);
	});
	add(tick + TPQ * 6, [0xb0, 64, 0]);

	const header = [...ascii('MThd'), ...u32(6), 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff];
	return new Uint8Array([...header, ...trackChunk(events)]);
}

// --- MusicXML: Prometheus study ---------------------------------------------------

const STEPS = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const ALTERS = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const FLAT_NAMES = { 1: ['D', -1], 3: ['E', -1], 8: ['A', -1], 10: ['B', -1] };
const TYPES = { 16: 'whole', 12: 'half', 8: 'half', 6: 'quarter', 4: 'quarter', 2: 'eighth' };

function pitch(midi, preferFlat = false) {
	const pc = midi % 12;
	const octave = Math.floor(midi / 12) - 1;
	const [step, alter] = preferFlat && FLAT_NAMES[pc] ? FLAT_NAMES[pc] : [STEPS[pc], ALTERS[pc]];
	return `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;
}

/** One note (or chord member) in divisions of a sixteenth (4 per quarter). */
function note({ midi, length, staff, chord = false, tie, flat = false }) {
	const ties = tie ? `<tie type="${tie}"/>` : '';
	const tied = tie ? `<notations><tied type="${tie}"/></notations>` : '';
	const dot = length === 12 || length === 6 ? '<dot/>' : '';
	return `<note>${chord ? '<chord/>' : ''}${pitch(midi, flat)}<duration>${length}</duration>${ties}<voice>${staff}</voice><type>${TYPES[length]}</type>${dot}<staff>${staff}</staff>${tied}</note>`;
}

function chordNotes(midis, length, staff, flat) {
	return midis.map((midi, i) => note({ midi, length, staff, chord: i > 0, flat })).join('');
}

function prometheusStudy() {
	const q = 4;
	// Right hand: [midi, length, tie?] per measure, from the Prometheus scale.
	const melody = [
		[[69, q], [70, q], [74, 2 * q, 'start']],
		[[74, q, 'stop'], [72, 2], [70, 2], [69, 2 * q]],
		[[66, q], [69, q], [76, 2 * q]],
		[[74, q], [72, q], [70, q], [69, q]],
		[[72, q], [76, q], [78, 2 * q]],
		[[72, 4 * q], [76, 4 * q, undefined, true], [81, 4 * q, undefined, true]],
	];
	// Left hand: one whole-note chord per measure (the lower half of a Mystic chord).
	const bass = [
		[48, 54, 58],
		[48, 54, 58],
		[51, 57, 61],
		[51, 57, 61],
		[42, 48, 52],
		[36, 48],
	];
	const dynamics = { 0: ['p', 54], 4: ['f', 106] };

	const measures = melody.map((rh, m) => {
		const parts = [];
		if (m === 0) {
			parts.push(
				'<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>' +
					'<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>',
				'<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>66</per-minute></metronome></direction-type><staff>1</staff><sound tempo="66"/></direction>',
			);
		}
		if (dynamics[m]) {
			const [mark, value] = dynamics[m];
			parts.push(
				`<direction placement="below"><direction-type><dynamics><${mark}/></dynamics></direction-type><staff>1</staff><sound dynamics="${value}"/></direction>`,
			);
		}
		for (const [midi, length, tie, chord] of rh) parts.push(note({ midi, length, staff: 1, tie, chord, flat: midi % 12 === 10 }));
		parts.push(`<backup><duration>${4 * q}</duration></backup>`);
		parts.push(chordNotes(bass[m], 4 * q, 2, true));
		if (m === melody.length - 1) parts.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
		return `<measure number="${m + 1}">${parts.join('')}</measure>`;
	});

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Prometheus Study</work-title></work>
  <identification><creator type="composer">Mysterium (demo)</creator></identification>
  <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    ${measures.join('\n    ')}
  </part>
</score-partwise>
`;
}

writeFileSync(new URL('mystic-arpeggios.mid', OUT), mysticArpeggios());
writeFileSync(new URL('prometheus-study.musicxml', OUT), prometheusStudy());
console.log('Wrote public/scores/mystic-arpeggios.mid and public/scores/prometheus-study.musicxml');
