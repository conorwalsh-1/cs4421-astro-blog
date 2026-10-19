# Mysterium: a Scriabin piano journal

[![CI](https://github.com/conorwalsh-1/cs4421-astro-blog/actions/workflows/ci.yml/badge.svg)](https://github.com/conorwalsh-1/cs4421-astro-blog/actions/workflows/ci.yml)

An interactive piano journal about Alexander Scriabin, built with Astro for
**CS4421 DevOps** (University of Limerick, ISE). Visitors can play a Web Audio
keyboard lit in Scriabin's *Prometheus* key colours, hear the Mystic chord, read
the journal, and leave notes in the **Listening room**.

## Architecture

```
                    ┌──────────────────── GitHub Actions ─────────────────────┐
 feature branch ──► │ CI: lint · astro check · unit+integration (coverage)    │
   pull request     │     · build · Playwright E2E · Docker build + health    │
                    └───────────────┬─────────────────────────┬───────────────┘
                          merge to main                 merge to main
                                    ▼                         ▼
                  deploy-static.yml (CDK)          deploy-container.yml (CDK)
                                    ▼                         ▼
   Browser ─HTTPS─► CloudFront ─► S3 (dist/client)   ECR ─► ECS Fargate ◄─ ALB ◄─ CloudFront ◄─HTTPS─ Browser
                                                          │
                                                          └─► CloudWatch logs, metric filter, alarms
```

| Layer | Tooling |
| --- | --- |
| App | Astro 7, `@astrojs/node` (standalone), MDX, Zod content collections |
| Static hosting (Week 4) | AWS CDK `StaticSiteStack`: S3 + CloudFront, OAC, auto-invalidation, security headers |
| Dynamic runtime (Weeks 5–7) | Multi-stage Docker image → Amazon ECR → ECS Fargate behind an ALB + CloudFront |
| Observability | `/api/health` probe, structured JSON logs, CloudWatch metric filter and alarms |
| Decisions | [ADR-001](docs/adr/ADR-001-transition-to-ssr-and-containers.md) |
| Operations | [Rollback drills runbook](docs/runbooks/rollback-drills.md) |

## Software development lifecycle

- **Plan:** GitHub Issues from the *User story* template (As a / I want / So that +
  Given-When-Then), tracked on a Kanban project board.
- **Code:** GitHub Flow: short-lived `feat/*` and `fix/*` branches, conventional commits,
  PRs with the Definition of Done template, CODEOWNERS review, protected `main`.
- **Test (shift-left):** see the testing pyramid below. Dependabot keeps npm and
  Actions dependencies patched.
- **Release:** every merge to `main` deploys both stacks automatically (continuous deployment).
- **Operate:** health checks, ECS deployment circuit breaker, CloudWatch alarms, and
  one-click rollback (`Rollback Container` workflow or a revert PR).

## Testing pyramid

| Level | Tool | Location | Command |
| --- | --- | --- | --- |
| Static analysis | ESLint (astro + typescript-eslint), `astro check` | `eslint.config.ts` | `npm run lint`, `npm run check` |
| Unit | Vitest | `src/**/*.test.ts` | `npm run test:unit` |
| Integration | Vitest against real API route handlers | `tests/integration/` | `npm run test:integration` |
| Coverage gate | `@vitest/coverage-v8` (≥ 80%) | `vitest.config.ts` | `npm run test:coverage` |
| End-to-end | Playwright (desktop + mobile Chromium) | `tests/e2e/` | `npm run test:e2e` |
| Infrastructure | Jest + CDK assertions | `cdk/test/` | `cd cdk && npm test` |
| Container | Docker build + `/api/health` probe | CI `container` job | `docker build .` |

## Running locally

Requires Node.js ≥ 22.12.

```bash
npm install
npm run dev                      # http://localhost:4321
npm run build                    # dist/client (static) + dist/server (Node)
HOST=0.0.0.0 PORT=4321 node ./dist/server/entry.mjs
curl -i http://localhost:4321/api/health
```

With Docker:

```bash
docker build --platform linux/amd64 -t astro-blog:v1.0.0 .
docker run -d -p 4321:4321 --name my-blog astro-blog:v1.0.0
docker inspect --format='{{json .State.Health}}' my-blog
```

## Deployment setup (one-off)

1. Create an IAM user for deployments and an access key.
2. Add repository secrets `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
3. Bootstrap CDK once: `cd cdk && npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1`.
4. Protect `main`: require a PR, one approval, and the `validate`, `e2e` and
   `container` checks.

The stack outputs `SiteUrl` (static site) and `AppUrl` (container app) appear in the
workflow logs and the CloudFormation console.

## Project structure

```
src/
  components/ColourKeyboard.astro   Web Audio keyboard in Scriabin's colours
  content/                          Journal posts + authors (Zod-validated)
  middleware.ts                     Structured JSON request logging
  pages/api/health.ts               Liveness probe
  pages/api/feedback.ts             Listening-room notes API
  pages/listening-room.astro        Server-rendered page
  utils/                            Music theory, logging, feedback store (+ tests)
tests/integration, tests/e2e        Integration and Playwright tests
cdk/                                AWS CDK app (static site, ECR, ECS)
docs/adr, docs/runbooks             Architecture decisions and runbooks
Dockerfile, .dockerignore           Multi-stage production image
```
