import type { Booking, Mailer } from './types.js';

function cancellationText(booking: Booking): string {
  return `Your ${booking.serviceName} booking was cancelled because payment was not completed within 24 hours of confirmation. No charge was made.`;
}

/** Amazon SES mailer (ADR-0009: only the Records API sends email). */
export class SesMailer implements Mailer {
  constructor(private readonly fromAddress: string, private readonly region?: string) {}

  async sendBookingCancelledForUnpaid(to: string, booking: Booking): Promise<void> {
    const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2');
    const client = new SESv2Client({ region: this.region });
    const text = cancellationText(booking);
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: this.fromAddress,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: `Your ${booking.serviceName} booking was cancelled` },
            Body: { Text: { Data: text }, Html: { Data: `<p>${escapeHtml(text)}</p>` } },
          },
        },
      }),
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Used when no SES sender is configured (non-production): logs instead of sending. */
export class LoggingMailer implements Mailer {
  constructor(private readonly log: (message: string) => void) {}

  async sendBookingCancelledForUnpaid(to: string, booking: Booking): Promise<void> {
    this.log(`cancellation email to ${to} for booking ${booking.id}`);
  }
}

export class FakeMailer implements Mailer {
  readonly sent: { to: string; bookingId: string }[] = [];

  async sendBookingCancelledForUnpaid(to: string, booking: Booking): Promise<void> {
    this.sent.push({ to, bookingId: booking.id });
  }
}
