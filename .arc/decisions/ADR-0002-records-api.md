---
id: ADR-0002
category: component
title: Records API
status: superseded
superseded_by: ADR-0013
component_id: comp_records_api
responsibility: 'Single REST backend service: authentication and authorization, business
  logic for records and workflows, validation, persistence, and the API consumed by
  the Web App directly (no gateway/BFF). Stack is open.'
kind: api_service
split_reason: Server-side runtime separate from the browser client
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: 'Human: API ''validates and stores data''; database is persistent storage'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'Human: API ''handles authentication and authorization''; Entra ID chosen'
rule: Expose one REST API that the Web App calls directly; add no gateway or BFF.
evidence:
- type: note
  ref: 'Human: ''Single REST API, no gateway'''
contested: true
alternatives:
- option: 'GraphQL API: not chosen by the human'
- option: 'REST API behind a gateway: not chosen by the human'
consequences:
- Cross-cutting edge concerns (rate limiting, WAF, throttling) must live in the API
  or the load balancer
- One API serves all roles, so authorization is enforced per role inside it
---

## Context

Human: 'Single REST API, no gateway'

## Decision

Single REST backend service: authentication and authorization, business logic for records and workflows, validation, persistence, and the API consumed by the Web App directly (no gateway/BFF). Stack is open.

Kept separate because Server-side runtime separate from the browser client.

## Talks to

- **Relational Database** (sync) — Human: API 'validates and stores data'; database is persistent storage
- **Identity Provider** (sync) — Human: API 'handles authentication and authorization'; Entra ID chosen

## Alternatives considered

- GraphQL API: not chosen by the human
- REST API behind a gateway: not chosen by the human

## Consequences

- Cross-cutting edge concerns (rate limiting, WAF, throttling) must live in the API or the load balancer
- One API serves all roles, so authorization is enforced per role inside it
