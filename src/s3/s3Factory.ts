import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

export const S3Factory = {
  provide: S3Client,
  useFactory: () => {
    let s3ClientConfig: S3ClientConfig;

    if (process.env.ENVIRONMENT === 'test') {
      s3ClientConfig = {
        endpoint: 'http://localstack:4566',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test',
          secretAccessKey: 'test',
        },
        forcePathStyle: true,
      };
    }

    const client = new S3Client(s3ClientConfig);

    return client;
  },
};
