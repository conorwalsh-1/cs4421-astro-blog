# ADR-001: Transition from Static Site to Containerized SSR Runtime

## Status: Accepted (Date: 2026-10-19)

## Context

Mysterium started as a statically generated Astro site deployed to Amazon S3
behind CloudFront (Week 4). The platform now needs server-side behaviour:

- `/api/health` so the container platform and load balancer can probe liveness.
- `/api/feedback`, which accepts and validates listening-room notes from visitors.
- `/listening-room`, a page rendered on each request from the current notes.

Static hosting on S3 cannot execute server-side Node.js code, so none of these
can be served from the existing deployment.

## Decision

We will configure Astro with the `@astrojs/node` adapter in `standalone` mode
(`output: 'server'`) and package the application as a Docker container
deployed to AWS.

- Journal, home and about pages keep `export const prerender = true`. They are
  still emitted as static HTML (to `dist/client/`), and the S3 + CloudFront
  stack keeps serving them.
- API routes and the listening room are rendered on demand by
  `dist/server/entry.mjs`.
- Every request is logged as one structured JSON line (`src/middleware.ts`)
  so CloudWatch can filter on fields such as `statusCode`.

## Consequences

- Positive: Enables live API routes, dynamic rendering and operational health checks.
- Positive: The static site and the container share one codebase and build.
- Negative: Increases operational complexity; requires a container compute runtime
  (ECR + ECS), which costs more than S3 alone.
- Negative: Listening-room notes are held in memory. They are lost on redeploy and
  are not shared between container instances, which breaks the 12-factor
  "stateless processes" rule. A follow-up ADR should move them to a datastore
  (e.g. DynamoDB) before scaling beyond one task.
