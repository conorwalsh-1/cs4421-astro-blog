# Static site infrastructure

This CDK app deploys the Astro `dist/` output to a private S3 bucket behind a
CloudFront distribution. CloudFront enforces HTTPS and serves Astro's
directory-style routes. Deployments upload the new site and invalidate the CDN.

## GitHub Actions setup

The `Deploy Static Site` workflow runs after changes are pushed to `main` (or
when manually dispatched). Configure these repository settings:

- Secret `AWS_ROLE_ARN`: an AWS IAM role configured to trust GitHub Actions via
  OIDC and permit CDK deployment.
- Variable `AWS_REGION`: the AWS region for the stack.

Bootstrap the target AWS account and region with the AWS CDK Toolkit before the
first workflow deployment: `npx cdk bootstrap aws://ACCOUNT_ID/REGION`.

## Local commands

Run `npm run build` at the repository root before running CDK commands so that
the Astro `dist/` directory exists. From this directory:

- `npm run build` type-checks the CDK app.
- `npm test -- --runInBand` runs the infrastructure tests.
- `npx cdk synth` synthesizes the CloudFormation template.
- `npx cdk diff` compares the stack with the deployed infrastructure.
- `npx cdk deploy` deploys the stack and static site.
