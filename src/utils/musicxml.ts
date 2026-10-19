// MusicXML (score-partwise) → Score. MusicXML is the interchange format for
// sheet music: MuseScore, Sibelius, Finale and Dorico all export it.
// Supports divisions, chords, voices (backup/forward), ties, tempo and dynamics
// markings, grace notes (skipped) and multiple parts. Repeats are played once.

import { buildTempoMap, finishScore, positionToSeconds, type Score, type TempoChange } from './score';

const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DEFAULT_BPM = 120;
const DEFAULT_VELOCITY = 0.7;
/** MusicXML dynamics are a percentage of forte, which is MIDI velocity 90. */
const FORTE_VELOCITY = 90 / 127;

const BEAT_UNIT_QUARTERS: Record<string, number> = {
	whole: 4,
	half: 2,
	quarter: 1,
	eighth: 0.5,
	'16th': 0.25,
	'32nd': 0.125,
};

export class MusicXmlParseError extends Error {}

interface BeatNote {
	midi: number;
	/** Start and end in quarter-note beats. */
	start: number;
	end: number;
	velocity: number;
}

const child = (element: Element, name: string): Element | undefined =>
	[...element.children].find((candidate) => candidate.tagName === name);

const childText = (element: Element, name: string): string | undefined => child(element, name)?.textContent?.trim();

const childNumber = (element: Element, name: string): number | undefined => {
	const text = childText(element, name);
	const value = text === undefined ? NaN : Number(text);
	return Number.isFinite(value) ? value : undefined;
};

export function looksLikeMusicXml(text: string): boolean {
	return /<score-(partwise|timewise)[\s>]/.test(text);
}

/** MIDI number of a <pitch> element. */
export function pitchToMidi(pitch: Element): number | undefined {
	const step = childText(pitch, 'step')?.toUpperCase();
	const octave = childNumber(pitch, 'octave');
	if (!step || !(step in STEP_SEMITONES) || octave === undefined) return undefined;
	const alter = Math.round(childNumber(pitch, 'alter') ?? 0);
	return (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
}

/** Tempo in quarter notes per minute from a <direction> or <sound> element, if it has one. */
function tempoOf(element: Element): number | undefined {
	const sounds = element.tagName === 'sound' ? [element] : [...element.getElementsByTagName('sound')];
	for (const sound of sounds) {
		const tempo = Number(sound.getAttribute('tempo'));
		if (tempo > 0) return tempo;
	}
	for (const metronome of element.getElementsByTagName('metronome')) {
		const perMinute = childNumber(metronome, 'per-minute');
		const unit = childText(metronome, 'beat-unit');
		if (!perMinute || !unit || !(unit in BEAT_UNIT_QUARTERS)) continue;
		const dotted = child(metronome, 'beat-unit-dot') ? 1.5 : 1;
		return perMinute * BEAT_UNIT_QUARTERS[unit] * dotted;
	}
	return undefined;
}

function dynamicsOf(element: Element): number | undefined {
	const sounds = element.tagName === 'sound' ? [element] : [...element.getElementsByTagName('sound')];
	for (const sound of sounds) {
		const dynamics = Number(sound.getAttribute('dynamics'));
		if (dynamics > 0) return Math.min(1, (dynamics / 100) * FORTE_VELOCITY);
	}
	return undefined;
}

export function parseMusicXml(xml: string, fallbackTitle = 'Untitled'): Score {
	const document = new DOMParser().parseFromString(xml, 'application/xml');
	if (document.getElementsByTagName('parsererror').length > 0) {
		throw new MusicXmlParseError('The file is not valid XML');
	}
	const root = document.documentElement;
	if (root.tagName === 'score-timewise') {
		throw new MusicXmlParseError('score-timewise MusicXML is not supported; export as partwise MusicXML');
	}
	if (root.tagName !== 'score-partwise') throw new MusicXmlParseError('Not a MusicXML score');

	const work = child(root, 'work');
	const title =
		(work && childText(work, 'work-title')) || childText(root, 'movement-title') || fallbackTitle;

	const notes: BeatNote[] = [];
	const tempos: TempoChange[] = [];

	for (const part of root.getElementsByTagName('part')) {
		let divisions = 1;
		let position = 0; // in quarter-note beats
		let chordStart = 0;
		let velocity = DEFAULT_VELOCITY;
		const tied = new Map<number, BeatNote>();

		for (const measure of part.getElementsByTagName('measure')) {
			for (const element of measure.children) {
				switch (element.tagName) {
					case 'attributes':
						divisions = childNumber(element, 'divisions') ?? divisions;
						break;
					case 'direction':
					case 'sound': {
						const bpm = tempoOf(element);
						if (bpm) tempos.push({ at: position, secondsPerUnit: 60 / bpm });
						velocity = dynamicsOf(element) ?? velocity;
						break;
					}
					case 'backup':
						position -= (childNumber(element, 'duration') ?? 0) / divisions;
						break;
					case 'forward':
						position += (childNumber(element, 'duration') ?? 0) / divisions;
						break;
					case 'note': {
						if (child(element, 'grace')) break; // Grace notes take no time.
						const length = (childNumber(element, 'duration') ?? 0) / divisions;
						const isChord = Boolean(child(element, 'chord'));
						const start = isChord ? chordStart : position;
						const pitch = child(element, 'pitch');
						const midi = pitch && !child(element, 'rest') ? pitchToMidi(pitch) : undefined;

						if (midi !== undefined) {
							const ties = [...element.children].filter((c) => c.tagName === 'tie');
							const tieStart = ties.some((tie) => tie.getAttribute('type') === 'start');
							const tieStop = ties.some((tie) => tie.getAttribute('type') === 'stop');
							const noteDynamics = Number(element.getAttribute('dynamics'));
							const noteVelocity =
								noteDynamics > 0 ? Math.min(1, (noteDynamics / 100) * FORTE_VELOCITY) : velocity;
							const continued = tieStop ? tied.get(midi) : undefined;

							if (continued) {
								// A tied note extends the note it is tied from instead of re-striking.
								continued.end = start + length;
								if (!tieStart) tied.delete(midi);
							} else {
								const note = { midi, start, end: start + length, velocity: noteVelocity };
								notes.push(note);
								if (tieStart) tied.set(midi, note);
							}
						}

						if (!isChord) {
							chordStart = position;
							position += length;
						}
						break;
					}
				}
			}
		}
	}

	const tempoMap = buildTempoMap(tempos, 60 / DEFAULT_BPM);
	const seconds = (beat: number) => positionToSeconds(beat, tempoMap);
	return finishScore(
		title,
		'MusicXML',
		notes.map(({ midi, start, end, velocity }) => {
			const time = seconds(start);
			return { midi, time, duration: seconds(end) - time, velocity };
		}),
	);
}
