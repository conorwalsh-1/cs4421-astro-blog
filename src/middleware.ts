import { defineMiddleware } from 'astro:middleware';
import { formatRequestLog } from './utils/logger';

// Emits one structured JSON log line per incoming request.
export const onRequest = defineMiddleware(async (context, next) => {
	// Prerendered pages run through middleware at build time; only log live traffic.
	if (context.isPrerendered) return next();

	const started = performance.now();
	const response = await next();

	console.log(
		formatRequestLog({
			route: context.url.pathname,
			method: context.request.method,
			statusCode: response.status,
			latencyMs: Math.round(performance.now() - started),
		}),
	);

	return response;
});
