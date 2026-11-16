---
type: Decision
title: Job ordering
description: FIFO applies within each tenant to keep worker replay predictable.
sources:
  - resource: ../queue-policy.md
review_owner: runtime-team
---

Workers claim jobs in FIFO order within each tenant so replay is predictable.
