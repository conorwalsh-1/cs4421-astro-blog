#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ContainerRegistryStack } from '../lib/container-registry-stack';
import { ContainerServiceStack } from '../lib/container-service-stack';
import { StaticSiteStack } from '../lib/static-site-stack';

const app = new cdk.App();

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' };

// CloudFront needs a verified AWS account. `cdk deploy -c cloudfront=false` serves the sites
// without it: the static site from S3 website hosting and the app from its load balancer.
const useCloudFront = String(app.node.tryGetContext('cloudfront') ?? 'true') !== 'false';

// Week 4: static Astro build on S3 + CloudFront (or S3 website hosting without CloudFront).
new StaticSiteStack(app, 'StaticSiteStack', { env, useCloudFront });

// Week 6: ECR repository for the Docker image.
const registry = new ContainerRegistryStack(app, 'ContainerRegistryStack', { env });

// Week 7: ECS Fargate service, load balancer and CloudWatch alarms.
new ContainerServiceStack(app, 'ContainerServiceStack', { env, repository: registry.repository, useCloudFront });
