import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { StaticSiteStack } from '../lib/static-site-stack';

test('creates a private bucket behind CloudFront with automatic invalidation', () => {
  const app = new cdk.App();
  const stack = new StaticSiteStack(app, 'MyTestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  template.hasResourceProperties('Custom::CDKBucketDeployment', {
    DistributionPaths: ['/*'],
  });
  template.hasOutput('SiteUrl', {});
});

test('without CloudFront, the bucket hosts the site itself and only allows public reads', () => {
  const app = new cdk.App();
  const stack = new StaticSiteStack(app, 'MyTestStack', { useCloudFront: false });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::CloudFront::Distribution', 0);
  template.hasResourceProperties('AWS::S3::Bucket', {
    WebsiteConfiguration: { IndexDocument: 'index.html' },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: false,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: false,
    },
  });
  template.hasResourceProperties('AWS::S3::BucketPolicy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({ Action: 's3:GetObject', Effect: 'Allow', Principal: { AWS: '*' } }),
      ]),
    },
  });
  template.hasOutput('SiteUrl', {});
});
