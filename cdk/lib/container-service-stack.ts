import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ContainerServiceStackProps extends cdk.StackProps {
  repository: ecr.IRepository;
  /** Image tag the service runs; the CD pipeline moves `latest` and forces a new deployment. */
  imageTag?: string;
}

// Week 7: the containerised Astro server on AWS ECS (Fargate) behind a load balancer.
export class ContainerServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: ContainerServiceStackProps) {
    super(scope, id, props);

    // Public subnets only (no NAT gateway) keeps the student bill small.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC }],
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const logGroup = new logs.LogGroup(this, 'AppLogs', {
      logGroupName: '/ecs/astro-blog',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      // Rolling update: start the new task before stopping the old one (zero downtime),
      // and roll back automatically if the new tasks never become healthy.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag ?? 'latest'),
        containerPort: 4321,
        environment: { NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '4321' },
        logDriver: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'astro-blog' }),
      },
    });

    service.targetGroup.configureHealthCheck({
      path: '/api/health',
      interval: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });
    service.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '10');

    // CloudWatch: count structured log lines with a 5xx status and alarm on them.
    const serverErrors = new logs.MetricFilter(this, 'ServerErrorsFilter', {
      logGroup,
      metricNamespace: 'AstroBlog',
      metricName: 'ServerErrors',
      filterPattern: logs.FilterPattern.numberValue('$.statusCode', '>=', 500),
      metricValue: '1',
      defaultValue: 0,
    });

    new cloudwatch.Alarm(this, 'ServerErrorsAlarm', {
      alarmDescription: 'HTTP 5xx responses logged by the astro-blog container',
      metric: serverErrors.metric({ statistic: 'Sum', period: cdk.Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'UnhealthyTargetsAlarm', {
      alarmDescription: 'Load balancer health checks on /api/health are failing',
      metric: service.targetGroup.metrics.unhealthyHostCount({ period: cdk.Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // HTTPS front door: CloudFront terminates TLS and forwards every request
    // (no caching) to the load balancer, adding standard security headers.
    const appDistribution = new cloudfront.Distribution(this, 'AppDistribution', {
      defaultBehavior: {
        origin: new origins.LoadBalancerV2Origin(service.loadBalancer, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'AppUrl', {
      value: `https://${appDistribution.distributionDomainName}`,
      description: 'HTTPS URL of the containerised Astro app',
    });
    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
      description: 'Load balancer URL (HTTP) used for smoke tests',
    });
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'ServiceName', { value: service.service.serviceName });
  }
}
