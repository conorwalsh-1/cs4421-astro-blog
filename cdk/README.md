# Static site infrastructure (AWS CDK)

This CDK app (`lib/static-site-stack.ts`) deploys the Astro build output to a
private S3 bucket behind a CloudFront distribution. CloudFront enforces HTTPS
and serves Astro's directory-style routes. Every deployment uploads the new
site through `BucketDeployment` and invalidates the CDN (`/*`).

## GitHub Actions setup

`.github/workflows/deploy-static.yml` runs on every push to `main` (or when
manually dispatched) and deploys to `us-east-1`. Add these **repository
secrets** (Settings → Secrets and variables → Actions):

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Bootstrap the AWS account once before the first deployment:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

## Local commands

Run `npm run build` at the repository root first so the Astro output exists.
From this directory:

- `npm test -- --runInBand` runs the infrastructure tests.
- `npx cdk synth` synthesizes the CloudFormation template.
- `npx cdk diff` compares the stack with the deployed infrastructure.
- `npx cdk deploy StaticSiteStack` deploys the stack and static site.
