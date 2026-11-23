---
id: ADR-0019
category: cross_cutting
title: 'Cross-cutting: Project constraints'
status: accepted
superseded_by: null
component_id: null
rule: Scope every organization-owned row and file by organization, and keep card data
  out of our systems.
decision: '- Scope: the marketplace, the organization portal and the stock dashboard
  are one system served by one Records API and one Web App.

  - Payments: no card data is stored, processed or transmitted by us (Stripe-hosted
  checkout); PCI DSS stays primarily with Stripe.

  - Payouts: none in the initial phase (STORY-036 deferred).

  - Receipts: generated and stored for history and reporting, with GST/tax shown where
  required.

  - Tenant isolation: data is logically isolated per organization; shared tables with
  an organization id on every row (assumed).

  - Email: Amazon SES is the assumed product.'
evidence:
- type: human
  ref: Stripe-hosted checkout; no payouts initially; receipts with GST; logical isolation
    per organization
basis: stated
---

## Decision

**Rule.** Scope every organization-owned row and file by organization, and keep card data out of our systems.

- Scope: the marketplace, the organization portal and the stock dashboard are one system served by one Records API and one Web App.
- Payments: no card data is stored, processed or transmitted by us (Stripe-hosted checkout); PCI DSS stays primarily with Stripe.
- Payouts: none in the initial phase (STORY-036 deferred).
- Receipts: generated and stored for history and reporting, with GST/tax shown where required.
- Tenant isolation: data is logically isolated per organization; shared tables with an organization id on every row (assumed).
- Email: Amazon SES is the assumed product.

## Evidence

Basis: stated.
- human: Stripe-hosted checkout; no payouts initially; receipts with GST; logical isolation per organization
