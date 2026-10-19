// Compressed MusicXML (.mxl) is a zip archive. This minimal reader finds the
// score named in META-INF/container.xml and inflates it with the built-in
// DecompressionStream, so no zip library is needed.

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

export class MxlError extends Error {}

interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	localHeaderOffset: number;
}

export function isZip(bytes: Uint8Array): boolean {
	return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04; // "PK\3\4"
}

function readEntries(bytes: Uint8Array): ZipEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// The end-of-central-directory record sits in the last 22 + 65535 bytes.
	let end = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
		if (view.getUint32(i, true) === END_OF_CENTRAL_DIRECTORY) {
			end = i;
			break;
		}
	}
	if (end === -1) throw new MxlError('Not a valid .mxl (zip) file');

	const count = view.getUint16(end + 10, true);
	let offset = view.getUint32(end + 16, true);
	const decoder = new TextDecoder();
	const entries: ZipEntry[] = [];
	for (let i = 0; i < count; i++) {
		if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_ENTRY) {
			throw new MxlError('Corrupt .mxl central directory');
		}
		const nameLength = view.getUint16(offset + 28, true);
		const extraLength = view.getUint16(offset + 30, true);
		const commentLength = view.getUint16(offset + 32, true);
		entries.push({
			method: view.getUint16(offset + 10, true),
			compressedSize: view.getUint32(offset + 20, true),
			localHeaderOffset: view.getUint32(offset + 42, true),
			name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
		});
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const header = entry.localHeaderOffset;
	if (view.getUint32(header, true) !== LOCAL_FILE_HEADER) throw new MxlError(`Corrupt entry ${entry.name}`);
	const start = header + 30 + view.getUint16(header + 26, true) + view.getUint16(header + 28, true);
	const data = bytes.slice(start, start + entry.compressedSize);

	if (entry.method === STORED) return new TextDecoder().decode(data);
	if (entry.method !== DEFLATED) throw new MxlError(`Unsupported compression in ${entry.name}`);
	const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
	return new Response(stream).text();
}

/** Returns the MusicXML text inside a compressed .mxl file. */
export async function unzipMxl(bytes: Uint8Array): Promise<string> {
	const entries = readEntries(bytes);
	const byName = new Map(entries.map((entry) => [entry.name, entry]));

	let scorePath: string | undefined;
	const container = byName.get('META-INF/container.xml');
	if (container) {
		scorePath = /full-path\s*=\s*"([^"]+)"/.exec(await readEntry(bytes, container))?.[1];
	}
	scorePath ??= entries.find((entry) => !entry.name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(entry.name))
		?.name;

	const score = scorePath ? byName.get(scorePath) : undefined;
	if (!score) throw new MxlError('No MusicXML score found inside the .mxl file');
	return readEntry(bytes, score);
}
