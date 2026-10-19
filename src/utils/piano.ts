// Browser-only piano synth (Web Audio) shared by the colour keyboard, the
// listening room and the score player.
import { midiToFrequency } from './scriabin';

let audio: AudioContext | undefined;
let output: GainNode | undefined;

/** Natural decay of a struck note when the key is held. */
const RING_SECONDS = 3.2;
/** Damper fade after a key is released. */
const RELEASE_SECONDS = 0.25;

interface Voice {
	envelope: GainNode;
	oscillators: OscillatorNode[];
	end: number;
}
const voices = new Set<Voice>();

// A short synthetic "hall" so held notes bloom like a pedalled piano.
function createReverb(context: AudioContext): ConvolverNode {
	const seconds = 2.5;
	const impulse = context.createBuffer(2, context.sampleRate * seconds, context.sampleRate);
	for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
		const data = impulse.getChannelData(channel);
		for (let i = 0; i < data.length; i++) {
			data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
		}
	}
	const reverb = context.createConvolver();
	reverb.buffer = impulse;
	return reverb;
}

function getAudio(): { context: AudioContext; destination: GainNode } {
	if (!audio || !output) {
		audio = new AudioContext();
		const master = audio.createGain();
		master.gain.value = 0.35;
		const reverb = createReverb(audio);
		const wet = audio.createGain();
		wet.gain.value = 0.3;
		master.connect(audio.destination);
		master.connect(reverb).connect(wet).connect(audio.destination);
		output = master;
	}
	return { context: audio, destination: output };
}

/** Current audio clock in seconds; starts (or resumes) audio after a user gesture. */
export function audioNow(): number {
	const { context } = getAudio();
	if (context.state === 'suspended') void context.resume();
	return context.currentTime;
}

/**
 * A simple piano-like voice: a few decaying partials.
 * @param when seconds from now
 * @param duration seconds the key is held; omitted = let the note ring out
 * @param at absolute audio-clock time, used by the score player instead of `when`
 */
export function strike(midi: number, when = 0, velocity = 1, duration?: number, at?: number) {
	const { context, destination } = getAudio();
	const start = at ?? context.currentTime + when;
	const frequency = midiToFrequency(midi);
	const peak = 0.5 * Math.max(0.05, Math.min(1, velocity));
	const ring = start + RING_SECONDS;
	const end = duration === undefined ? ring : Math.min(ring, start + duration + RELEASE_SECONDS);

	const envelope = context.createGain();
	envelope.gain.setValueAtTime(0, start);
	envelope.gain.linearRampToValueAtTime(peak, start + 0.008);
	if (duration !== undefined && start + duration < ring) {
		// Decay while held, then the damper falls when the key is released.
		const released = start + Math.max(duration, 0.01);
		const level = peak * Math.pow(0.0002 / peak, (released - start) / RING_SECONDS);
		envelope.gain.exponentialRampToValueAtTime(Math.max(level, 0.0001), released);
		envelope.gain.exponentialRampToValueAtTime(0.0001, end);
	} else {
		envelope.gain.exponentialRampToValueAtTime(0.0001, ring);
	}
	envelope.connect(destination);

	const oscillators = [
		{ ratio: 1, gain: 1, type: 'triangle' as OscillatorType },
		{ ratio: 2, gain: 0.35, type: 'sine' as OscillatorType },
		{ ratio: 3, gain: 0.12, type: 'sine' as OscillatorType },
	].map(({ ratio, gain, type }) => {
		const oscillator = context.createOscillator();
		const partialGain = context.createGain();
		oscillator.type = type;
		oscillator.frequency.value = frequency * ratio;
		partialGain.gain.value = gain;
		oscillator.connect(partialGain).connect(envelope);
		oscillator.start(start);
		oscillator.stop(end + 0.05);
		return oscillator;
	});

	const voice: Voice = { envelope, oscillators, end };
	voices.add(voice);
	oscillators[0].onended = () => {
		voices.delete(voice);
		envelope.disconnect();
	};
}

/** Silences every sounding and scheduled note (used when playback stops or pauses). */
export function silenceAll() {
	if (!audio) return;
	const now = audio.currentTime;
	for (const voice of voices) {
		voice.envelope.gain.cancelScheduledValues(now);
		voice.envelope.gain.setTargetAtTime(0, now, 0.03);
		for (const oscillator of voice.oscillators) {
			try {
				oscillator.stop(now + 0.15);
			} catch {
				// Already stopped.
			}
		}
	}
	voices.clear();
}
