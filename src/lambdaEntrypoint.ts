import awsServerlessExpress from '@vendia/serverless-express';
import { APIGatewayProxyEvent, Callback, Context } from 'aws-lambda';
import { AppInstance } from './app.instance';

export { runMigrations } from './runMigrations';

let appServer: ReturnType<typeof awsServerlessExpress>;

export const app = async (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback<any>,
) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (!appServer) {
    const nestApp = await AppInstance.getInstance();
    await nestApp.init();
    const app = nestApp.getHttpAdapter().getInstance();
    appServer = awsServerlessExpress({ app });
  }

  const response = await appServer(event, context, callback);

  return response;
};
