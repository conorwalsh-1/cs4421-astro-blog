import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ContainerRegistryStack } from '../lib/container-registry-stack';

test('creates the astro-blog ECR repository with scan on push', () => {
  const app = new cdk.App();
  const stack = new ContainerRegistryStack(app, 'MyRegistryStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::ECR::Repository', {
    RepositoryName: 'astro-blog',
    ImageScanningConfiguration: { ScanOnPush: true },
  });
  template.hasOutput('RepositoryUri', {});
});
