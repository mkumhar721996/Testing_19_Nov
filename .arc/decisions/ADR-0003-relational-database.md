---
id: ADR-0003
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Persistent storage for user accounts, application data, configuration
  settings and audit records; runs on PostgreSQL (Amazon RDS).
kind: managed_service
split_reason: Backing service the project uses but does not build
rule: Only the Records API reads or writes the Relational Database, which runs on
  PostgreSQL on Amazon RDS.
evidence: 'Human: ''PostgreSQL on Amazon RDS'''
---

## Context

Human: 'PostgreSQL on Amazon RDS'

## Decision

Persistent storage for user accounts, application data, configuration settings and audit records; runs on PostgreSQL (Amazon RDS).

Kept separate because Backing service the project uses but does not build.
