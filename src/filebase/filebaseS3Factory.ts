import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Secrets } from '../awsSecrets/awsSecrets.module';
import { ISecrets } from '../awsSecrets/awsSecrets.interface';

export const FilebaseS3Factory = {
  provide: S3Client,
  inject: [Secrets],
  useFactory: (secrets: ISecrets) => {
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
    } else {
      s3ClientConfig = {
        endpoint: 'https://s3.filebase.com',
        region: 'us-east-1',
        credentials: {
          accessKeyId: secrets.FILEBASE_ACCESS_TOKEN,
          secretAccessKey: secrets.FILEBASE_SECRET_KEY,
        },
        forcePathStyle: true,
      };
    }

    const client = new S3Client(s3ClientConfig);

    return client;
  },
};
