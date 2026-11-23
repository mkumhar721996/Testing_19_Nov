---
id: ADR-0018
category: integration_surface
title: 'Integration: Stripe API (bidirectional)'
status: accepted
superseded_by: null
component_id: comp_records_api
rule: Only the Records API talks to Stripe; card details are entered only in Stripe-hosted
  checkout and never pass through or rest in our systems.
evidence:
- type: human
  ref: Stripe will be used for payment processing; card payments handled by Stripe-hosted
    checkout/payment components
- type: work_item
  ref: TETSING-19-NOV-STORY-034
basis: stated
---

## Decision

**Rule.** Only the Records API talks to Stripe; card details are entered only in Stripe-hosted checkout and never pass through or rest in our systems.

Stripe API (bidirectional)

Applies to Records API.

## Evidence

Basis: stated.
- human: Stripe will be used for payment processing; card payments handled by Stripe-hosted checkout/payment components
- work_item: TETSING-19-NOV-STORY-034
