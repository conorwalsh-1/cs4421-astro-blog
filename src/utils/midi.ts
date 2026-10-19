// Standard MIDI File (SMF, formats 0 and 1) parser → Score.
// Handles running status, tempo changes, SMPTE timing, note-on with velocity 0
// as note-off, and the sustain pedal (CC 64). Channel 10 percussion is skipped.

import { buildTempoMap, finishScore, positionToSeconds, type Score, type ScoreNote, type TempoChange } from './score';

const PERCUSSION_CHANNEL = 9;
const SUSTAIN_PEDAL = 64;
const DEFAULT_MICROSECONDS_PER_QUARTER = 500_000; // 120 bpm

interface NoteEvent {
	tick: number;
	order: number;
	channel: number;
	midi: number;
	/** 0 means note-off. */
	velocity: number;
}

interface PedalEvent {
	tick: number;
	order: number;
	channel: number;
	down: boolean;
}

export class MidiParseError extends Error {}

class Reader {
	position = 0;

	constructor(private readonly bytes: Uint8Array) {}

	get remaining(): number {
		return this.bytes.length - this.position;
	}

	byte(): number {
		if (this.position >= this.bytes.length) throw new MidiParseError('Unexpected end of MIDI file');
		return this.bytes[this.position++];
	}

	peek(): number {
		return this.bytes[this.position];
	}

	uint16(): number {
		return (this.byte() << 8) | this.byte();
	}

	uint32(): number {
		return ((this.byte() << 24) >>> 0) + (this.byte() << 16) + (this.byte() << 8) + this.byte();
	}

	ascii(length: number): string {
		let text = '';
		for (let i = 0; i < length; i++) text += String.fromCharCode(this.byte());
		return text;
	}

	/** Variable-length quantity (7 bits per byte, high bit = continue). */
	varLength(): number {
		let value = 0;
		for (let i = 0; i < 4; i++) {
			const byte = this.byte();
			value = (value << 7) | (byte & 0x7f);
			if ((byte & 0x80) === 0) return value;
		}
		throw new MidiParseError('Invalid variable-length value');
	}

	slice(length: number): Uint8Array {
		if (length > this.remaining) throw new MidiParseError('Chunk runs past the end of the file');
		const view = this.bytes.subarray(this.position, this.position + length);
		this.position += length;
		return view;
	}
}

export function isMidi(bytes: Uint8Array): boolean {
	return bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64; // "MThd"
}

export function parseMidi(bytes: Uint8Array, fallbackTitle = 'Untitled'): Score {
	if (!isMidi(bytes)) throw new MidiParseError('Not a MIDI file (missing MThd header)');
	const reader = new Reader(bytes);
	reader.ascii(4);
	const headerLength = reader.uint32();
	const header = new Reader(reader.slice(headerLength));
	const format = header.uint16();
	const trackCount = header.uint16();
	const division = header.uint16();
	if (format > 1) throw new MidiParseError(`MIDI format ${format} is not supported (only 0 and 1)`);

	// Ticks per quarter note, or SMPTE frames × ticks per frame (fixed seconds per tick).
	const smpte = (division & 0x8000) !== 0;
	const ticksPerQuarter = division & 0x7fff;
	const smpteSecondsPerTick = smpte ? 1 / (-((division >> 8) << 24 >> 24) * (division & 0xff)) : 0;

	const notes: NoteEvent[] = [];
	const pedals: PedalEvent[] = [];
	const tempos: TempoChange[] = [];
	let title: string | undefined;
	let order = 0;
	let endTick = 0;

	for (let track = 0; track < trackCount && reader.remaining >= 8; track++) {
		const chunkType = reader.ascii(4);
		const chunk = reader.slice(reader.uint32());
		if (chunkType !== 'MTrk') continue; // Unknown chunks must be skipped.

		const events = new Reader(chunk);
		let tick = 0;
		let runningStatus = 0;
		while (events.remaining > 0) {
			tick += events.varLength();
			endTick = Math.max(endTick, tick);
			let status = events.peek();
			if (status & 0x80) events.byte();
			else if (runningStatus) status = runningStatus;
			else throw new MidiParseError('Data byte without a status byte');

			if (status === 0xff) {
				const type = events.byte();
				const data = events.slice(events.varLength());
				if (type === 0x51 && data.length === 3 && !smpte) {
					const microseconds = (data[0] << 16) | (data[1] << 8) | data[2];
					tempos.push({ at: tick, secondsPerUnit: microseconds / 1e6 / ticksPerQuarter });
				} else if (type === 0x03 && title === undefined && data.length > 0) {
					title = new TextDecoder().decode(data).trim() || undefined;
				} else if (type === 0x2f) {
					break;
				}
				continue;
			}
			if (status === 0xf0 || status === 0xf7) {
				events.slice(events.varLength()); // SysEx
				continue;
			}

			runningStatus = status;
			const kind = status & 0xf0;
			const channel = status & 0x0f;
			if (kind === 0x80 || kind === 0x90) {
				const midi = events.byte();
				const velocity = events.byte();
				if (channel !== PERCUSSION_CHANNEL) {
					notes.push({ tick, order: order++, channel, midi, velocity: kind === 0x80 ? 0 : velocity });
				}
			} else if (kind === 0xb0) {
				const controller = events.byte();
				const value = events.byte();
				if (controller === SUSTAIN_PEDAL) pedals.push({ tick, order: order++, channel, down: value >= 64 });
			} else if (kind === 0xc0 || kind === 0xd0) {
				events.byte();
			} else {
				events.byte();
				events.byte();
			}
		}
	}

	const tempoMap = smpte
		? [{ at: 0, secondsPerUnit: smpteSecondsPerTick }]
		: buildTempoMap(tempos, DEFAULT_MICROSECONDS_PER_QUARTER / 1e6 / ticksPerQuarter);
	const seconds = (tick: number) => positionToSeconds(tick, tempoMap);

	return finishScore(title ?? fallbackTitle, 'MIDI', pairNotes(notes, pedals, seconds, endTick));
}

/** Matches note-ons with note-offs, holding notes while the sustain pedal is down. */
function pairNotes(
	notes: NoteEvent[],
	pedals: PedalEvent[],
	seconds: (tick: number) => number,
	endTick: number,
): ScoreNote[] {
	type Timeline = ({ type: 'note' } & NoteEvent) | ({ type: 'pedal' } & PedalEvent);
	const timeline: Timeline[] = [
		...notes.map((event) => ({ type: 'note' as const, ...event })),
		...pedals.map((event) => ({ type: 'pedal' as const, ...event })),
	].sort((a, b) => a.tick - b.tick || a.order - b.order);

	const open = new Map<string, { tick: number; velocity: number }[]>();
	const sustained = new Map<number, Set<string>>();
	const pedalDown = new Set<number>();
	const result: ScoreNote[] = [];

	const close = (key: string, tick: number) => {
		const started = open.get(key)?.shift();
		if (!started) return;
		const midi = Number(key.split(':')[1]);
		const time = seconds(started.tick);
		result.push({ midi, time, duration: seconds(tick) - time, velocity: started.velocity / 127 });
	};

	for (const event of timeline) {
		if (event.type === 'pedal') {
			if (event.down) {
				pedalDown.add(event.channel);
			} else {
				pedalDown.delete(event.channel);
				for (const key of sustained.get(event.channel) ?? []) close(key, event.tick);
				sustained.delete(event.channel);
			}
			continue;
		}

		const key = `${event.channel}:${event.midi}`;
		if (event.velocity > 0) {
			// Re-striking a key that is only held by the pedal ends the old note.
			if (sustained.get(event.channel)?.delete(key)) close(key, event.tick);
			open.set(key, [...(open.get(key) ?? []), { tick: event.tick, velocity: event.velocity }]);
		} else if (pedalDown.has(event.channel)) {
			if (!sustained.has(event.channel)) sustained.set(event.channel, new Set());
			sustained.get(event.channel)?.add(key);
		} else {
			close(key, event.tick);
		}
	}

	// Notes never released (or still under the pedal) end with the piece.
	for (const [key, starts] of open) for (let i = starts.length; i > 0; i--) close(key, endTick);
	return result;
}
