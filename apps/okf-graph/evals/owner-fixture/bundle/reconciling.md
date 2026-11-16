---
type: Reference
title: Reconciling a submission
description: Determine which ledger entry to reconcile when a submitted row looks like one already processed.
sources:
  - resource: ../records.md
review_owner: settlements
---

The account and client key identify the posting to reconcile. Different accounts have separate key namespaces. For a repeat within one account, use the existing posting ID. Matching on amount or batch filename can mistake two separate movements for one.

A timeout can leave the submitter without a response even though the posting exists. Look up the account and key before submitting the row again.
