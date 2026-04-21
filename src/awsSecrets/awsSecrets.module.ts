import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  GetSecretValueCommand,
  GetSecretValueRequest,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { IConfig } from '../config/config';
import { ISecrets } from './awsSecrets.interface';
import { AwsSecretsManagerMock } from './awsSecrets.mock';

export const Secrets = 'Secrets';

export const SecretsFactory = {
  provide: Secrets,
  inject: [ConfigService, SecretsManagerClient],
  useFactory: async (
    config: ConfigService<IConfig>,
    secretManagerClient: SecretsManagerClient,
  ) => {
    const secretsPath: string = config.get('SECRETS_PATH');

    const params: GetSecretValueRequest = {
      SecretId: secretsPath,
    };

    const command = new GetSecretValueCommand(params);

    const secret = await secretManagerClient.send(command);

    if (!secret.SecretString) {
      throw new Error('Cannot fetch secrets from AWS');
    }

    const secrets: ISecrets = JSON.parse(secret.SecretString);

    return secrets;
  },
};

@Module({
  providers: [
    SecretsFactory,
    {
      provide: SecretsManagerClient,
      useFactory: (configService: ConfigService<IConfig, true>) => {
        const env = configService.get('ENVIRONMENT');

        if (env === 'test') {
          return new AwsSecretsManagerMock();
        }

        return new SecretsManagerClient();
      },
      inject: [ConfigService],
    },
  ],
  exports: [Secrets, SecretsManagerClient],
})
export class AwsSecretsModule {}
