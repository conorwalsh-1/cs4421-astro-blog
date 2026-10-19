#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ContainerRegistryStack } from '../lib/container-registry-stack';
import { ContainerServiceStack } from '../lib/container-service-stack';
import { StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' };

// Week 4: static Astro build on S3 + CloudFront.
new StaticSiteStack(app, 'StaticSiteStack', { env });

// Week 6: ECR repository for the Docker image.
const registry = new ContainerRegistryStack(app, 'ContainerRegistryStack', { env });

// Week 7: ECS Fargate service, load balancer and CloudWatch alarms.
new ContainerServiceStack(app, 'ContainerServiceStack', { env, repository: registry.repository });
