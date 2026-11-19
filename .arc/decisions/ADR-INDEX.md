# ADR Index

One line per decision — the rule, not the reasoning. Read the full ADR (`.arc/decisions/ADR-NNNN-*.md`) for context and rationale.

## Accepted — binding rules

| ADR | Category | Status | Rule |
|---|---|---|---|
| ADR-0001 | component | accepted | The Web App talks to backend data only through the Records API. |
| ADR-0002 | component | accepted | Expose one REST API that the Web App calls directly; add no gateway or BFF. |
| ADR-0003 | component | accepted | Only the Records API reads or writes the Relational Database, which runs on PostgreSQL on Amazon RDS. |
| ADR-0004 | component | accepted | All user sign-in goes through Entra ID; the Records API accepts only tokens it issued. |
| ADR-0005 | nfr | accepted | Design for up to 1,000 registered users and 100 concurrent users. |
| ADR-0006 | nfr | accepted | Production monthly availability is at least 99.9%. |
| ADR-0007 | nfr | accepted | Records API p95 latency stays under 500 ms. |
| ADR-0008 | deployment_target | accepted | Run all components as containers on AWS in one region with prod and staging; no multi-region. |
| ADR-0009 | integration_surface | accepted | Only the Records API sends email, through Amazon SES; no other external integrations exist. |
| ADR-0010 | cross_cutting | accepted | Keep all data in the single AWS region and encrypt it in transit and at rest. |
| ADR-0011 | cross_cutting | accepted | Every create, update and role change is written to an audit record with actor and time. |
