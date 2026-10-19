// Plays a Score with a look-ahead scheduler: a timer wakes every TICK_MS and
// schedules the notes due in the next LOOKAHEAD_SECONDS on the audio clock.
// The clock and outputs are injected so the timing logic is testable.

import { firstNoteAtOrAfter, type Score } from './score';

export const LOOKAHEAD_SECONDS = 0.3;
export const TICK_MS = 50;

export interface PlayerOutput {
	/** Audio clock in seconds. */
	now(): number;
	/** Sound a note at an absolute audio-clock time for `duration` seconds. */
	playNote(midi: number, at: number, velocity: number, duration: number): void;
	/** Light keys after `delay` seconds; notes struck together are grouped, each lit for its own length. */
	lightNotes(midis: number[], delay: number, durations: number[]): void;
	/** Cut every sounding or scheduled note. */
	silence(): void;
	onProgress?(position: number): void;
	onStateChange?(state: PlayerState): void;
}

export type PlayerState = 'stopped' | 'playing' | 'paused';

export class ScorePlayer {
	private state: PlayerState = 'stopped';
	private speed = 1;
	/** Score position (seconds) at the audio-clock time `anchorClock`. */
	private anchorPosition = 0;
	private anchorClock = 0;
	private nextIndex = 0;
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly score: Score,
		private readonly output: PlayerOutput,
	) {}

	get playbackState(): PlayerState {
		return this.state;
	}

	get playbackSpeed(): number {
		return this.speed;
	}

	/** Current position in the score, in seconds. */
	get position(): number {
		if (this.state !== 'playing') return this.anchorPosition;
		return Math.min(this.score.duration, this.anchorPosition + (this.output.now() - this.anchorClock) * this.speed);
	}

	play(): void {
		if (this.state === 'playing' || this.score.notes.length === 0) return;
		if (this.anchorPosition >= this.score.duration) this.anchorPosition = 0;
		this.anchorClock = this.output.now();
		this.nextIndex = firstNoteAtOrAfter(this.score.notes, this.anchorPosition);
		this.setState('playing');
		this.tick();
		this.timer = setInterval(() => this.tick(), TICK_MS);
	}

	pause(): void {
		if (this.state !== 'playing') return;
		this.anchorPosition = this.position;
		this.halt();
		this.setState('paused');
	}

	stop(): void {
		this.anchorPosition = 0;
		this.halt();
		this.setState('stopped');
		this.output.onProgress?.(0);
	}

	/** Jump to a position (seconds); keeps playing if it was playing. */
	seek(position: number): void {
		const wasPlaying = this.state === 'playing';
		this.anchorPosition = Math.max(0, Math.min(this.score.duration, position));
		if (wasPlaying) {
			this.halt();
			this.state = 'paused';
			this.play();
		} else {
			this.output.onProgress?.(this.anchorPosition);
		}
	}

	setSpeed(speed: number): void {
		if (!(speed > 0)) return;
		if (this.state === 'playing') {
			// Re-anchor so the position stays continuous, then reschedule at the new speed.
			this.anchorPosition = this.position;
			this.halt();
			this.speed = speed;
			this.state = 'paused';
			this.play();
		} else {
			this.speed = speed;
		}
	}

	private halt(): void {
		if (this.timer !== undefined) clearInterval(this.timer);
		this.timer = undefined;
		this.output.silence();
	}

	private setState(state: PlayerState): void {
		this.state = state;
		this.output.onStateChange?.(state);
	}

	private tick(): void {
		const now = this.output.now();
		const position = this.position;
		const horizon = position + LOOKAHEAD_SECONDS * this.speed;
		const { notes } = this.score;

		while (this.nextIndex < notes.length && notes[this.nextIndex].time < horizon) {
			const groupTime = notes[this.nextIndex].time;
			const group: number[] = [];
			const durations: number[] = [];
			// Notes struck together are lit together.
			while (this.nextIndex < notes.length && notes[this.nextIndex].time === groupTime) {
				const note = notes[this.nextIndex++];
				const delay = Math.max(0, (note.time - position) / this.speed);
				const duration = note.duration / this.speed;
				this.output.playNote(note.midi, now + delay, note.velocity, duration);
				group.push(note.midi);
				durations.push(duration);
			}
			this.output.lightNotes(group, Math.max(0, (groupTime - position) / this.speed), durations);
		}

		this.output.onProgress?.(position);
		if (position >= this.score.duration) {
			this.anchorPosition = this.score.duration;
			if (this.timer !== undefined) clearInterval(this.timer);
			this.timer = undefined;
			this.setState('stopped');
		}
	}
}
