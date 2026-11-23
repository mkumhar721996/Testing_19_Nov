---
id: ADR-0015
category: component
title: Records Worker
status: accepted
superseded_by: null
component_id: comp_records_worker
responsibility: 'Background worker for scheduled and timed jobs: notifications and
  email sending, reminders, report generation, cleanup, and the 24-hour payment auto-cancel.
  Reads and writes the Relational Database.'
kind: worker
serves:
- TETSING-19-NOV-EPIC-005
- TETSING-19-NOV-EPIC-006
- TETSING-19-NOV-EPIC-007
split_reason: Scheduled jobs run on their own schedule, separate from request handling;
  the human asked for a separate worker.
talks_to:
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: separate background worker for scheduled tasks
rule: Run scheduled and timed jobs in the Records Worker, not inside the Records API.
evidence:
- type: human
  ref: use a separate background worker for scheduled tasks such as notifications,
    reminders, report generation, and cleanup jobs
- type: work_item
  ref: TETSING-19-NOV-STORY-034
basis: stated
---

## Context

The draft recorded none for this component.

Serves: TETSING-19-NOV-EPIC-005, TETSING-19-NOV-EPIC-006, TETSING-19-NOV-EPIC-007.

## Decision

**Rule.** Run scheduled and timed jobs in the Records Worker, not inside the Records API.

Background worker for scheduled and timed jobs: notifications and email sending, reminders, report generation, cleanup, and the 24-hour payment auto-cancel. Reads and writes the Relational Database.

Kept separate because Scheduled jobs run on their own schedule, separate from request handling; the human asked for a separate worker..

## Talks to

- **Relational Database** (shared-storage) — separate background worker for scheduled tasks

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: use a separate background worker for scheduled tasks such as notifications, reminders, report generation, and cleanup jobs
- work_item: TETSING-19-NOV-STORY-034
