// Detects the format of an uploaded file and parses it into a Score.

import { isMidi, parseMidi } from './midi';
import { looksLikeMusicXml, parseMusicXml } from './musicxml';
import { isZip, unzipMxl } from './mxl';
import type { Score } from './score';

export const ACCEPTED_EXTENSIONS = ['.mid', '.midi', '.musicxml', '.xml', '.mxl'];

export class UnsupportedScoreError extends Error {}

const titleFromFileName = (fileName: string) => fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

export async function loadScore(fileName: string, bytes: Uint8Array): Promise<Score> {
	const title = titleFromFileName(fileName) || 'Untitled';

	if (isMidi(bytes)) return parseMidi(bytes, title);
	if (isZip(bytes)) return parseMusicXml(await unzipMxl(bytes), title);

	const text = new TextDecoder().decode(bytes);
	if (looksLikeMusicXml(text)) return parseMusicXml(text, title);

	if (/\.pdf$/i.test(fileName) || /\.(png|jpe?g|gif|webp)$/i.test(fileName)) {
		throw new UnsupportedScoreError(
			'PDFs and images of sheet music cannot be read directly. Export the score as MusicXML (e.g. from MuseScore) or MIDI.',
		);
	}
	throw new UnsupportedScoreError(`Unsupported file. Use one of: ${ACCEPTED_EXTENSIONS.join(', ')}`);
}
