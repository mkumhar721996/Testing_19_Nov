---
id: ADR-0001
category: component
title: Web App
status: superseded
superseded_by: ADR-0012
component_id: comp_web_app
responsibility: Browser UI for sign-in, profile, creating/updating/viewing records,
  search and filter, dashboards and reports, workflow status and notifications.
kind: web_ui
split_reason: Browser client is a different runtime from the API
talks_to:
- component_id: comp_records_api
  interaction: sync
  evidence: 'Human: ''Single REST API, no gateway'''
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'Human: ''Entra ID'' for sign-in'
rule: The Web App talks to backend data only through the Records API.
evidence:
- type: note
  ref: 'Human: ''1. Web UI (Frontend)'' in system overview'
---

## Context

Human: '1. Web UI (Frontend)' in system overview

## Decision

Browser UI for sign-in, profile, creating/updating/viewing records, search and filter, dashboards and reports, workflow status and notifications.

Kept separate because Browser client is a different runtime from the API.

## Talks to

- **Records API** (sync) — Human: 'Single REST API, no gateway'
- **Identity Provider** (sync) — Human: 'Entra ID' for sign-in
