import type { APIRoute } from 'astro';
import { feedbackSchema, feedbackStore } from '../../utils/feedback';
import { logEvent } from '../../utils/logger';

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => json({ notes: feedbackStore.list() });

export const POST: APIRoute = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Request body must be JSON' }, 400);
	}

	const result = feedbackSchema.safeParse(body);
	if (!result.success) {
		return json({ error: 'Invalid note', issues: result.error.issues.map((issue) => issue.message) }, 422);
	}

	const note = feedbackStore.add(result.data);
	logEvent('INFO', 'listening-room note added', { noteId: note.id, key: note.key });
	return json({ note }, 201);
};
