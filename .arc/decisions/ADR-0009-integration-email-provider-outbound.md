---
id: ADR-0009
category: integration_surface
title: 'Integration: Email Provider (outbound)'
status: retired
superseded_by: null
component_id: comp_records_api
rule: Only the Records API sends email, through Amazon SES; no other external integrations
  exist.
evidence:
- type: note
  ref: 'recommended default, accepted by the human without review: Amazon SES (on
    AWS)'
---

## Context

recommended default, accepted by the human without review: Amazon SES (on AWS)

## Decision

Email Provider (outbound)

Applies to Records API.
