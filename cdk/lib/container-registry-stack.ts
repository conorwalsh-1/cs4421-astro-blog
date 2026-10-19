import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';

// Week 6: Amazon ECR repository that stores the tagged Docker images (astro-blog:v1.0.0, astro-blog:<sha>).
export class ContainerRegistryStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'AstroBlogRepository', {
      repositoryName: 'astro-blog',
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [{ description: 'Keep the 20 most recent images', maxImageCount: 20 }],
    });

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'docker tag astro-blog:v1.0.0 <RepositoryUri>:v1.0.0',
    });
  }
}
