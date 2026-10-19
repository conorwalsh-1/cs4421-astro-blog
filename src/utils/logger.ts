// Structured JSON logging: one JSON object per line on stdout, so CloudWatch
// can filter on keys, e.g. { $.statusCode >= 500 }.

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface RequestLog {
	route: string;
	method: string;
	statusCode: number;
	latencyMs: number;
}

export function levelForStatus(statusCode: number): LogLevel {
	if (statusCode >= 500) return 'ERROR';
	if (statusCode >= 400) return 'WARN';
	return 'INFO';
}

export function formatRequestLog(entry: RequestLog, now: Date = new Date()): string {
	return JSON.stringify({
		timestamp: now.toISOString(),
		level: levelForStatus(entry.statusCode),
		...entry,
	});
}

export function logEvent(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
	console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...fields }));
}
