// Browser-only: connects a ScorePlayer to the synth and to a colour keyboard,
// so every scheduled note sounds and lights its key for its own length.

import { audioNow, silenceAll, strike } from './piano';
import type { PlayerOutput } from './score-player';

export function keyboardOutput(
	keyboard: Element | null,
	callbacks: Pick<PlayerOutput, 'onProgress' | 'onStateChange'> = {},
): PlayerOutput & { clearLights(): void } {
	const pending = new Set<ReturnType<typeof setTimeout>>();
	const clearLights = () => {
		pending.forEach(clearTimeout);
		pending.clear();
	};

	return {
		now: audioNow,
		playNote: (midi, at, velocity, duration) => strike(midi, 0, velocity, duration, at),
		lightNotes: (midis, delay, durations) => {
			if (!keyboard) return;
			const timer = setTimeout(() => {
				pending.delete(timer);
				keyboard.dispatchEvent(
					new CustomEvent('colour-keyboard:light', {
						detail: { midis, durations: durations.map((seconds) => Math.max(0.12, seconds)) },
					}),
				);
			}, delay * 1000);
			pending.add(timer);
		},
		silence: () => {
			clearLights();
			silenceAll();
		},
		clearLights,
		...callbacks,
	};
}
