// Integration tests: call the real Astro API route handlers with real Requests.
import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { POST as postFeedback, GET as listFeedback } from '../../src/pages/api/feedback';
import { GET as health } from '../../src/pages/api/health';

const context = (request: Request) => ({ request }) as unknown as APIContext;

const postJson = (body: unknown) =>
	postFeedback(
		context(
			new Request('http://localhost/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: typeof body === 'string' ? body : JSON.stringify(body),
			}),
		),
	);

describe('GET /api/health', () => {
	it('returns 200 with JSON status, uptime and timestamp', async () => {
		const response = await health(context(new Request('http://localhost/api/health')));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(body.status).toBe('ok');
		expect(body.uptime).toBeTypeOf('number');
		expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
	});
});

describe('/api/feedback', () => {
	it('stores a valid note and lists it', async () => {
		const created = await postJson({ name: 'Conor', piece: 'Sonata No. 5', key: 'F#', message: 'Ecstatic' });
		expect(created.status).toBe(201);
		const { note } = await created.json();

		const listed = await listFeedback(context(new Request('http://localhost/api/feedback')));
		const { notes } = await listed.json();
		expect(notes[0]).toMatchObject({ id: note.id, piece: 'Sonata No. 5', key: 'F#' });
	});

	it('rejects malformed JSON with 400', async () => {
		const response = await postJson('{not json');
		expect(response.status).toBe(400);
	});

	it('rejects an invalid note with 422', async () => {
		const response = await postJson({ name: 'Conor', piece: '', key: 'H' });
		expect(response.status).toBe(422);
	});
});
