---
type: Contract
title: Posting identity
description: When two settlement submissions count as the same posting.
sources:
  - resource: ../register.md
review_owner: ledger-team
---

Posting identity is the pair of account and client key. Reusing a key within one account returns the existing posting. This prevents a repeated submission from moving funds twice. Different accounts have independent keys.
