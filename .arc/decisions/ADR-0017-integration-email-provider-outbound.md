---
id: ADR-0017
category: integration_surface
title: 'Integration: Email Provider (outbound)'
status: accepted
superseded_by: null
component_id: comp_records_worker
rule: Only the Records Worker and Records API send email, through Amazon SES.
evidence:
- type: human
  ref: background worker for notifications
- type: work_item
  ref: TETSING-19-NOV-EPIC-007
basis: stated
---

## Decision

**Rule.** Only the Records Worker and Records API send email, through Amazon SES.

Email Provider (outbound)

Applies to Records Worker.

## Evidence

Basis: stated.
- human: background worker for notifications
- work_item: TETSING-19-NOV-EPIC-007
