import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

// Astro build output, resolved from this file so `cdk deploy` works from any directory.
// With the Node adapter (Week 5) Astro writes prerendered pages to dist/client.
const SITE_DIST = path.resolve(__dirname, '../../dist/client');

export interface StaticSiteStackProps extends cdk.StackProps {
  /** Serve through CloudFront (default). Without it the bucket hosts the site itself, over HTTP. */
  useCloudFront?: boolean;
}

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: StaticSiteStackProps) {
    super(scope, id, props);

    if (props?.useCloudFront === false) {
      this.websiteBucket();
      return;
    }

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Rewrites pretty URLs (/blog/ or /about) to the index.html files Astro generates.
    const directoryIndex = new cloudfront.Function(this, 'DirectoryIndexFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
`),
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: directoryIndex, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(SITE_DIST)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'], // Automatic CloudFront CDN cache invalidation!
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'HTTPS URL for the deployed static site',
    });
  }

  /** S3 static website hosting: no CDN, HTTPS or security headers, but no account verification needed. */
  private websiteBucket() {
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html', // also serves /blog/ from blog/index.html
      // Only a bucket policy granting public reads; ACLs stay blocked.
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      sources: [s3deploy.Source.asset(SITE_DIST)],
      destinationBucket: siteBucket,
    });

    new cdk.CfnOutput(this, 'SiteUrl', {
      value: siteBucket.bucketWebsiteUrl,
      description: 'HTTP URL of the S3-hosted static site',
    });
  }
}
