import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ContainerRegistryStack } from '../lib/container-registry-stack';
import { ContainerServiceStack } from '../lib/container-service-stack';

function synth() {
  const app = new cdk.App();
  const registry = new ContainerRegistryStack(app, 'MyRegistryStack');
  const stack = new ContainerServiceStack(app, 'MyServiceStack', { repository: registry.repository });
  return Template.fromStack(stack);
}

test('runs the container on Fargate with a rolling, self-healing deployment', () => {
  const template = synth();

  template.hasResourceProperties('AWS::ECS::Service', {
    LaunchType: 'FARGATE',
    DeploymentConfiguration: {
      MinimumHealthyPercent: 100,
      MaximumPercent: 200,
      DeploymentCircuitBreaker: { Enable: true, Rollback: true },
    },
  });
});

test('health-checks /api/health on port 4321', () => {
  const template = synth();

  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    HealthCheckPath: '/api/health',
    Port: 80,
  });
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [{ PortMappings: [{ ContainerPort: 4321 }] }],
  });
});

test('ships logs to CloudWatch and alarms on 5xx responses', () => {
  const template = synth();

  template.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/ecs/astro-blog' });
  template.hasResourceProperties('AWS::Logs::MetricFilter', { FilterPattern: '{ $.statusCode >= 500 }' });
  template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
});

test('serves the app over HTTPS through CloudFront', () => {
  const template = synth();

  template.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: { DefaultCacheBehavior: { ViewerProtocolPolicy: 'redirect-to-https' } },
  });
  template.hasOutput('AppUrl', {});
});
