---
id: ADR-0011
category: cross_cutting
title: 'Cross-cutting: Audit logging'
status: accepted
superseded_by: null
component_id: null
rule: Every create, update and role change is written to an audit record with actor
  and time.
decision: The Records API records who changed which record and when, stored in the
  Relational Database.
evidence: 'Human: database stores ''Audit'' data; support teams monitor activity'
---

## Context

Human: database stores 'Audit' data; support teams monitor activity

## Decision

The Records API records who changed which record and when, stored in the Relational Database.
