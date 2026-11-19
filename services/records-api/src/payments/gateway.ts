import type { ChargeRequest, ChargeResult, PaymentGateway } from './types.js';

/** Stand-in until a payment service is chosen: `tok_decline` is declined, `tok_error` fails, anything else succeeds. */
export class StubPaymentGateway implements PaymentGateway {
  readonly charges: ChargeRequest[] = [];

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.charges.push(request);
    if (request.paymentToken === 'tok_decline') return { status: 'declined', reason: 'card_declined' };
    if (request.paymentToken === 'tok_error') return { status: 'failed', reason: 'gateway_error' };
    return { status: 'succeeded', chargeId: `ch_stub_${request.idempotencyKey}` };
  }
}
