import { AppInstance } from './app.instance';

async function bootstrap() {
  const app = await AppInstance.getInstance();
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0', () => {
    console.log('Server started on http://0.0.0.0:3000');
  });
}

bootstrap();
