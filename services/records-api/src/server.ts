import { buildApp } from './app.js';
import { startUnpaidBookingSweeper } from './jobs/unpaid-booking-sweeper.js';
import { systemClock } from './payments/clock.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 8011);
const sweepIntervalMs = Number(process.env.UNPAID_SWEEP_INTERVAL_MS ?? 60_000);

const app = buildApp();
app
  .listen({ host, port })
  .then(() => {
    const stop = startUnpaidBookingSweeper(app.paymentService, systemClock, sweepIntervalMs, (err) =>
      app.log.error(err),
    );
    app.addHook('onClose', async () => stop());
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
