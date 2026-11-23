---
id: ADR-0004
category: component
title: Identity Provider
status: superseded
superseded_by: ADR-0014
component_id: comp_identity_provider
responsibility: Signs users in and issues tokens carrying roles for end users, operations,
  administrators and support; runs on Microsoft Entra ID.
kind: managed_service
split_reason: Identity provider the project uses but does not build
rule: All user sign-in goes through Entra ID; the Records API accepts only tokens
  it issued.
evidence:
- type: note
  ref: 'Human: ''Entra ID'''
---

## Context

Human: 'Entra ID'

## Decision

Signs users in and issues tokens carrying roles for end users, operations, administrators and support; runs on Microsoft Entra ID.

Kept separate because Identity provider the project uses but does not build.
