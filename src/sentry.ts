import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  if (process.env.SENTRY_DSN) {
    console.log('Setting up Sentry');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // integrations: [nodeProfilingIntegration()],
      tracesSampleRate: 1.0,
      // profilesSampleRate: 1.0,
    });
  } else {
    console.log('SENTRY_DSN env is not set. Skipping sentry initialization');
  }
}
