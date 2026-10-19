// A format-independent score: every MIDI or MusicXML file is turned into this.

export interface ScoreNote {
	/** MIDI note number (60 = middle C). */
	midi: number;
	/** Start time in seconds from the beginning of the piece. */
	time: number;
	/** Length in seconds. */
	duration: number;
	/** Loudness from 0 to 1. */
	velocity: number;
}

export interface Score {
	title: string;
	format: 'MIDI' | 'MusicXML';
	/** Notes sorted by start time. */
	notes: ScoreNote[];
	/** Seconds until the last note ends. */
	duration: number;
}

/** A tempo change at a position measured in beats (quarter notes) or ticks. */
export interface TempoChange {
	at: number;
	/** Seconds per beat / tick from `at` onwards. */
	secondsPerUnit: number;
}

/**
 * Converts a position in beats or ticks to seconds using a tempo map.
 * The map must be sorted by `at` and start at 0.
 */
export function positionToSeconds(position: number, tempoMap: TempoChange[]): number {
	let seconds = 0;
	for (let i = 0; i < tempoMap.length; i++) {
		const { at, secondsPerUnit } = tempoMap[i];
		const next = tempoMap[i + 1]?.at ?? Infinity;
		if (position <= at) break;
		seconds += (Math.min(position, next) - at) * secondsPerUnit;
		if (position <= next) break;
	}
	return seconds;
}

/** Builds a sorted, de-duplicated tempo map starting at 0. */
export function buildTempoMap(changes: TempoChange[], defaultSecondsPerUnit: number): TempoChange[] {
	const sorted = [...changes].sort((a, b) => a.at - b.at);
	const map: TempoChange[] = [{ at: 0, secondsPerUnit: defaultSecondsPerUnit }];
	for (const change of sorted) {
		// A later change at the same position wins.
		if (change.at === map[map.length - 1].at) map[map.length - 1] = change;
		else map.push(change);
	}
	return map;
}

export function finishScore(title: string, format: Score['format'], notes: ScoreNote[]): Score {
	const sorted = notes
		.filter((note) => note.duration > 0)
		.sort((a, b) => a.time - b.time || a.midi - b.midi);
	const duration = sorted.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
	return { title, format, notes: sorted, duration };
}

/** Index of the first note starting at or after `time` (binary search). */
export function firstNoteAtOrAfter(notes: ScoreNote[], time: number): number {
	let low = 0;
	let high = notes.length;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (notes[mid].time < time) low = mid + 1;
		else high = mid;
	}
	return low;
}

/** Formats seconds as m:ss. */
export function formatClock(seconds: number): string {
	const whole = Math.max(0, Math.floor(seconds));
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
