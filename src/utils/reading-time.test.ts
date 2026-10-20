import { describe, expect, it } from 'vitest';
import { formatReadingTime, proseWords, readingMinutes, WORDS_PER_MINUTE } from './reading-time';

const words = (n: number) => Array.from({ length: n }, () => 'note').join(' ');

describe('proseWords', () => {
	it('counts words, keeping accented letters, apostrophes and opus numbers whole', () => {
		expect(proseWords("Scriabin's clavier à lumières, Op. 60")).toEqual([
			"Scriabin's",
			'clavier',
			'à',
			'lumières',
			'Op.',
			'60',
		]);
	});

	it('ignores Markdown punctuation, emphasis and headings', () => {
		expect(proseWords('## A colour for **every** key — *Prometheus*')).toHaveLength(6);
	});

	it('skips frontmatter, MDX imports, components and code', () => {
		const body = [
			'---',
			"title: 'Not counted'",
			'---',
			"import ColourKeyboard from '../../components/ColourKeyboard.astro';",
			'<ColourKeyboard mysticDemo palette="scriabin" label="Scriabin colour keyboard" />',
			'```js',
			'const notCounted = true;',
			'```',
			'Press play.',
		].join('\n');
		expect(proseWords(body)).toEqual(['Press', 'play.']);
	});

	it('keeps link text but drops URLs, images and table rules', () => {
		const body = '[the composer](/composers/scriabin/) ![portrait](/a.png)\n| Key | Colour |\n| --- | ------ |';
		expect(proseWords(body)).toEqual(['the', 'composer', 'Key', 'Colour']);
	});
});

describe('readingMinutes', () => {
	it('rounds to the nearest minute at the average reading speed', () => {
		expect(readingMinutes(words(WORDS_PER_MINUTE * 4))).toBe(4);
		expect(readingMinutes(words(WORDS_PER_MINUTE * 2.4))).toBe(2);
		expect(readingMinutes(words(WORDS_PER_MINUTE * 2.6))).toBe(3);
	});

	it('never says less than a minute', () => {
		expect(readingMinutes('')).toBe(1);
		expect(readingMinutes('A short note.')).toBe(1);
	});
});

it('formats the reading time', () => {
	expect(formatReadingTime(4)).toBe('4 min read');
});
