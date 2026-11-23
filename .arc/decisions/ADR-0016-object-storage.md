---
id: ADR-0016
category: component
title: Object Storage
status: proposed
superseded_by: null
component_id: comp_object_storage
responsibility: Stores provider photos, licence/insurance documents and other files;
  runs on Amazon S3 (assumed, matching the AWS hosting). Files are served only through
  access the Records API authorizes, scoped by organization.
kind: managed_service
serves:
- TETSING-19-NOV-EPIC-004
split_reason: Backing service the project uses but does not build; holds admin-only
  documents (STORY-018).
rule: Files live only in Object Storage and are reachable only through a Records API
  authorization check.
evidence:
- type: human
  ref: use object storage (e.g., Azure Blob Storage/AWS S3) for files and documents
- type: work_item
  ref: TETSING-19-NOV-STORY-018
basis: assumed
---

## Context

The draft recorded none for this component.

Serves: TETSING-19-NOV-EPIC-004.

## Decision

**Rule.** Files live only in Object Storage and are reachable only through a Records API authorization check.

Stores provider photos, licence/insurance documents and other files; runs on Amazon S3 (assumed, matching the AWS hosting). Files are served only through access the Records API authorizes, scoped by organization.

Kept separate because Backing service the project uses but does not build; holds admin-only documents (STORY-018)..

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: assumed.
- human: use object storage (e.g., Azure Blob Storage/AWS S3) for files and documents
- work_item: TETSING-19-NOV-STORY-018
