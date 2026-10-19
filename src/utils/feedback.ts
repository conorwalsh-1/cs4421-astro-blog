import { z } from 'astro/zod';
import { PITCH_CLASSES } from './scriabin';

export const feedbackSchema = z.object({
	name: z.string().trim().min(1).max(40),
	piece: z.string().trim().min(1).max(80),
	key: z.enum(PITCH_CLASSES),
	message: z.string().trim().max(280).default(''),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type FeedbackEntry = FeedbackInput & { id: string; createdAt: string };

const MAX_ENTRIES = 50;

/**
 * In-memory store for listening-room notes. Notes live only as long as the
 * container (see docs/adr/ADR-001); a database would make them durable.
 */
export class FeedbackStore {
	private entries: FeedbackEntry[] = [];

	add(input: FeedbackInput, now: Date = new Date()): FeedbackEntry {
		const entry: FeedbackEntry = { ...input, id: crypto.randomUUID(), createdAt: now.toISOString() };
		this.entries = [entry, ...this.entries].slice(0, MAX_ENTRIES);
		return entry;
	}

	list(): FeedbackEntry[] {
		return [...this.entries];
	}
}

export const feedbackStore = new FeedbackStore();
