---
id: ADR-0013
category: component
title: Records API
status: accepted
superseded_by: null
component_id: comp_records_api
responsibility: 'Single REST backend service (TypeScript server in services/records-api):
  authentication and authorization, role and organization scoping, business logic
  and validation, persistence and email sending. The Web App calls it directly, with
  no gateway or BFF.'
kind: api_service
serves:
- TETSING-19-NOV-EPIC-003
- TETSING-19-NOV-EPIC-004
- TETSING-19-NOV-EPIC-005
- TETSING-19-NOV-EPIC-006
- TETSING-19-NOV-EPIC-007
- TETSING-19-NOV-EPIC-008
- TETSING-19-NOV-EPIC-009
- TETSING-19-NOV-EPIC-010
- TETSING-19-NOV-EPIC-011
split_reason: 'Already built: the TypeScript server in services/records-api (src/server.ts);
  a server-side runtime is separate from the browser client.'
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: 'Human: API ''validates and stores data''; database is persistent storage'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'Human: API ''handles authentication and authorization''; Entra ID chosen'
- component_id: comp_object_storage
  interaction: sync
  evidence: TETSING-19-NOV-STORY-018
rule: Expose one REST API that the Web App calls directly; add no gateway or BFF.
evidence:
- type: scan
  ref: services/records-api
basis: derived
contested: true
alternatives:
- option: 'GraphQL API: not chosen by the human'
- option: 'REST API behind a gateway: not chosen by the human'
consequences:
- Cross-cutting edge concerns (rate limiting, WAF, throttling) must live in the API
  or the load balancer
- One API serves all roles, so authorization is enforced per role inside it
supersedes:
- ADR-0002
---

## Context

The draft recorded none for this component.

Serves: TETSING-19-NOV-EPIC-003, TETSING-19-NOV-EPIC-004, TETSING-19-NOV-EPIC-005, TETSING-19-NOV-EPIC-006, TETSING-19-NOV-EPIC-007, TETSING-19-NOV-EPIC-008, TETSING-19-NOV-EPIC-009, TETSING-19-NOV-EPIC-010, TETSING-19-NOV-EPIC-011.

## Decision

**Rule.** Expose one REST API that the Web App calls directly; add no gateway or BFF.

Single REST backend service (TypeScript server in services/records-api): authentication and authorization, role and organization scoping, business logic and validation, persistence and email sending. The Web App calls it directly, with no gateway or BFF.

Kept separate because Already built: the TypeScript server in services/records-api (src/server.ts); a server-side runtime is separate from the browser client..

## Talks to

- **Relational Database** (sync) — Human: API 'validates and stores data'; database is persistent storage
- **Identity Provider** (sync) — Human: API 'handles authentication and authorization'; Entra ID chosen
- **Object Storage** (sync) — TETSING-19-NOV-STORY-018

## Alternatives considered

- GraphQL API: not chosen by the human
- REST API behind a gateway: not chosen by the human

## Consequences

- Cross-cutting edge concerns (rate limiting, WAF, throttling) must live in the API or the load balancer
- One API serves all roles, so authorization is enforced per role inside it

## Evidence

Basis: derived.
- scan: services/records-api
