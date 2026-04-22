import { DataSourceOptions } from 'typeorm';
import { entities } from './entities';

export const getDbConfig = (): DataSourceOptions => ({
  host: process.env.DB_HOST,
  type: 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
