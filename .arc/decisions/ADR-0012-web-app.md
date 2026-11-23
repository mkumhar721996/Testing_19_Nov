---
id: ADR-0012
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Browser UI (React) for sign-in, role-specific screens, browsing and
  search, booking, payment and receipt views, notifications, admin screens, organization
  list and detail panel, and dashboard panels. Calls backend data only through the
  Records API.
kind: web_ui
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
split_reason: 'Already built: the React browser app in apps/web; a browser client
  is a different runtime from the API.'
talks_to:
- component_id: comp_records_api
  interaction: sync
  evidence: 'Human: ''Single REST API, no gateway'''
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'Human: ''Entra ID'' for sign-in'
rule: The Web App talks to backend data only through the Records API.
evidence:
- type: scan
  ref: apps/web
basis: derived
supersedes:
- ADR-0001
---

## Context

The draft recorded none for this component.

Serves: TETSING-19-NOV-EPIC-003, TETSING-19-NOV-EPIC-004, TETSING-19-NOV-EPIC-005, TETSING-19-NOV-EPIC-006, TETSING-19-NOV-EPIC-007, TETSING-19-NOV-EPIC-008, TETSING-19-NOV-EPIC-009, TETSING-19-NOV-EPIC-010, TETSING-19-NOV-EPIC-011.

## Decision

**Rule.** The Web App talks to backend data only through the Records API.

Browser UI (React) for sign-in, role-specific screens, browsing and search, booking, payment and receipt views, notifications, admin screens, organization list and detail panel, and dashboard panels. Calls backend data only through the Records API.

Kept separate because Already built: the React browser app in apps/web; a browser client is a different runtime from the API..

## Talks to

- **Records API** (sync) — Human: 'Single REST API, no gateway'
- **Identity Provider** (sync) — Human: 'Entra ID' for sign-in

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: derived.
- scan: apps/web
