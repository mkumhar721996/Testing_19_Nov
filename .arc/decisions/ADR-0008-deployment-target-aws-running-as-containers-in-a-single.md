---
id: ADR-0008
category: deployment_target
title: "Deployment target: AWS, running as containers, in a single region (us-east-1)\
  \ with prod and\u2026"
status: accepted
superseded_by: null
component_id: null
rule: Run all components as containers on AWS in one region with prod and staging;
  no multi-region.
decision: AWS, running as containers, in a single region (us-east-1) with prod and
  staging environments; the database is Multi-AZ within that region.
evidence: recommended default, accepted by the human without review
---

## Context

recommended default, accepted by the human without review

## Decision

AWS, running as containers, in a single region (us-east-1) with prod and staging environments; the database is Multi-AZ within that region.
