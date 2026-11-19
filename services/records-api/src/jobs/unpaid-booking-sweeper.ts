import type { PaymentService } from '../payments/payment-service.js';
import type { Clock } from '../payments/types.js';

/** Cancels unpaid bookings every `intervalMs`; returns a function that stops the timer. */
export function startUnpaidBookingSweeper(
  service: PaymentService,
  clock: Clock,
  intervalMs: number,
  onError: (error: unknown) => void = () => {},
): () => void {
  const timer = setInterval(() => {
    service.cancelUnpaidBookings(clock.now()).catch(onError);
  }, intervalMs);
  return () => clearInterval(timer);
}
