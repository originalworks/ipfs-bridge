import { DataSourceOptions } from 'typeorm';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { entities } from './entities';

type DatabaseSecret = {
  username: string;
  password: string;
};

const secretsManager = new SecretsManagerClient();

const getDatabaseSecret = async (): Promise<DatabaseSecret> => {
  const secretId = process.env.DB_SECRET_ID;

  if (!secretId) {
    return {
      username: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
    };
  }

  const response = await secretsManager.send(
    new GetSecretValueCommand({ SecretId: secretId }),
  );

  if (!response.SecretString) {
    throw new Error(`Database secret ${secretId} has no SecretString`);
  }

  const secret = JSON.parse(response.SecretString) as Partial<DatabaseSecret>;

  if (!secret.username || !secret.password) {
    throw new Error(
      `Database secret ${secretId} must contain username and password`,
    );
  }

  return secret as DatabaseSecret;
};

const databaseCredentials = () => ({
  username: process.env.DB_USER,
  password: process.env.DB_SECRET_ID
    ? async () => (await getDatabaseSecret()).password
    : process.env.DB_PASSWORD,
});

export const getDbConfig = (): DataSourceOptions => ({
  host: process.env.DB_HOST,
  type: 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  ...databaseCredentials(),
  database: process.env.DB_DATABASE,
  entities,
  migrations: ['out/dist/migrations/*.js'],
  synchronize: false,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const dbCreatorConfig = (): DataSourceOptions => ({
  name: 'db-creator',
  host: process.env.DB_HOST,
  type: 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  ...databaseCredentials(),
  database: process.env.ROOT_DB_NAME,
  synchronize: false,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const testDbConfig = (): DataSourceOptions => ({
  host: process.env.DB_HOST,
  port: 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  type: 'postgres',
  entities: ['src/**/**.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
  dropSchema: true,
});
