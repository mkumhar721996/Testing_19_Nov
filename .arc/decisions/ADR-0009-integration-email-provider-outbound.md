---
id: ADR-0009
category: integration_surface
title: 'Integration: Email Provider (outbound)'
status: accepted
superseded_by: null
component_id: comp_records_api
rule: Only the Records API sends email, through Amazon SES; no other external integrations
  exist.
evidence: 'recommended default, accepted by the human without review: Amazon SES (on
  AWS)'
---

## Context

recommended default, accepted by the human without review: Amazon SES (on AWS)

## Decision

Email Provider (outbound)

Applies to Records API.
