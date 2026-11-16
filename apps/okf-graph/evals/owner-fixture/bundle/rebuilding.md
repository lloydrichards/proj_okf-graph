---
type: Guide
title: Rebuilding a batch
description: Replay archived entries and reconcile each result to the operator's worksheet.
sources:
  - resource: ../records.md
review_owner: settlements
---

Verify the archive checksum and load the rows into the submission worksheet. For each row, keep the account and client key from the archive. If the ledger already holds that pair, record the returned posting ID in the worksheet. Generating a new key merely to get past a match risks moving the money twice.

When an archived row needs a correction, attach its approval paperwork before submission. Reconcile the posting ID from the response and close the worksheet after all rows are accounted for.
