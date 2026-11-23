---
id: ADR-0014
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Signs users in and issues tokens carrying roles; runs on Microsoft
  Entra ID (identity owner still to confirm, STORY-041).
kind: managed_service
serves:
- TETSING-19-NOV-EPIC-003
- TETSING-19-NOV-EPIC-010
split_reason: Identity provider the project uses but does not build
rule: All user sign-in goes through Entra ID; the Records API accepts only tokens
  it issued.
evidence:
- type: human
  ref: Entra ID
- type: work_item
  ref: TETSING-19-NOV-STORY-041
basis: stated
supersedes:
- ADR-0004
---

## Context

The draft recorded none for this component.

Serves: TETSING-19-NOV-EPIC-003, TETSING-19-NOV-EPIC-010.

## Decision

**Rule.** All user sign-in goes through Entra ID; the Records API accepts only tokens it issued.

Signs users in and issues tokens carrying roles; runs on Microsoft Entra ID (identity owner still to confirm, STORY-041).

Kept separate because Identity provider the project uses but does not build.

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: Entra ID
- work_item: TETSING-19-NOV-STORY-041
