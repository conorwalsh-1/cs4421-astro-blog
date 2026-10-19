// Browser-only piano synth (Web Audio) shared by the colour keyboard and the listening room.
import { midiToFrequency } from './scriabin';

let audio: AudioContext | undefined;
let output: AudioNode | undefined;

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

function getAudio(): { context: AudioContext; destination: AudioNode } {
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

// A simple piano-like voice: a few decaying partials.
export function strike(midi: number, when = 0, velocity = 1) {
	const { context, destination } = getAudio();
	const start = context.currentTime + when;
	const frequency = midiToFrequency(midi);
	const envelope = context.createGain();
	envelope.gain.setValueAtTime(0, start);
	envelope.gain.linearRampToValueAtTime(0.5 * velocity, start + 0.008);
	envelope.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
	envelope.connect(destination);

	[
		{ ratio: 1, gain: 1, type: 'triangle' as OscillatorType },
		{ ratio: 2, gain: 0.35, type: 'sine' as OscillatorType },
		{ ratio: 3, gain: 0.12, type: 'sine' as OscillatorType },
	].forEach(({ ratio, gain, type }) => {
		const oscillator = context.createOscillator();
		const partialGain = context.createGain();
		oscillator.type = type;
		oscillator.frequency.value = frequency * ratio;
		partialGain.gain.value = gain;
		oscillator.connect(partialGain).connect(envelope);
		oscillator.start(start);
		oscillator.stop(start + 3.3);
	});
}
