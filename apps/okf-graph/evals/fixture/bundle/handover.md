---
type: Note
title: Worker handover
description: Notes from moving tenant checks into the queue.
---

Monday thoughts. Workers claim jobs FIFO within a tenant. Need coffee. The runtime rejects a missing tenant ID before enqueue. Someone suggested two retries, someone else four. I closed the editor before lunch.

See `queue-policy.md` in the repository root for what we agreed.
