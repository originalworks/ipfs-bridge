import { DataSource } from 'typeorm';
import { dbCreatorConfig, getDbConfig } from './config/dbConfig';
import {
  CodeDeployClient,
  LifecycleEventStatus,
  PutLifecycleEventHookExecutionStatusCommand,
} from '@aws-sdk/client-codedeploy';

export const createDBIfNotExists = async (dataBaseName: string) => {
  const dataSource = new DataSource({ ...dbCreatorConfig(), logging: true });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  console.log('Created dbCreatorConnection');

  const query = await dataSource.query(
    `SELECT datname FROM pg_database WHERE datname = '${dataBaseName}'`,
  );

  if (!query[0]?.datname) {
    await dataSource.query(`CREATE DATABASE "${dataBaseName}"`);
    console.log(`${dataBaseName} was created`);
  }

  await dataSource.destroy();
  console.log('dbCreatorConnection was closed');
};

export const runMigrations = async (event) => {
  const date = new Date().toISOString();
  console.log('date', date);
  const codedeploy = new CodeDeployClient({ apiVersion: date });

  const dbConfig = getDbConfig();
  console.log('Running database migrations');
  const dataBaseName = dbConfig.database.toString();
  let dataSource: DataSource;
  let result: Partial<LifecycleEventStatus>;

  await createDBIfNotExists(dataBaseName);

  try {
    dataSource = new DataSource({ ...dbConfig, logging: true });
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    console.log(`Established connection with db: ${dataBaseName}`);

    await dataSource.runMigrations({
      transaction: 'all',
    });
    result = 'Succeeded';
    console.log('Finished running migrations');
  } catch (error) {
    console.error('run migrations error', error);
  } finally {
    console.log('finally run migrations');

    await dataSource.destroy();

    if (event.DeploymentId) {
      const command = new PutLifecycleEventHookExecutionStatusCommand({
        deploymentId: event.DeploymentId,
        lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
        status: result,
      });

      const endOfMigration = await codedeploy.send(command);

      console.log('endOfMigration', endOfMigration);
    }
  }
};
