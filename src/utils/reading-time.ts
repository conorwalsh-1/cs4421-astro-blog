/** Average adult reading speed for prose, in words per minute. */
export const WORDS_PER_MINUTE = 200;

/** The words a reader actually reads in a Markdown or MDX post: no imports, components, code or markup. */
export function proseWords(body: string): string[] {
	const prose = body
		.replace(/^---[\s\S]*?^---\s*$/m, ' ') // frontmatter
		.replace(/^```[\s\S]*?^```\s*$/gm, ' ') // fenced code
		.replace(/^\s*(import|export)\s.*$/gm, ' ') // MDX imports and exports
		.replace(/<[^>]*>/g, ' ') // HTML tags and MDX components
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
		.replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, ' '); // table separator rows
	return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? [];
}

/** Whole minutes to read a post, never less than one. */
export function readingMinutes(body: string): number {
	return Math.max(1, Math.round(proseWords(body).length / WORDS_PER_MINUTE));
}

/** "4 min read". */
export const formatReadingTime = (minutes: number) => `${minutes} min read`;
