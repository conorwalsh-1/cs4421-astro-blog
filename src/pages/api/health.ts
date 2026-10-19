import type { APIRoute } from 'astro';

// Liveness probe used by the Docker HEALTHCHECK and the AWS load balancer.
export const GET: APIRoute = async () => {
	return new Response(
		JSON.stringify({
			status: 'ok',
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		}),
		{ status: 200, headers: { 'Content-Type': 'application/json' } },
	);
};
