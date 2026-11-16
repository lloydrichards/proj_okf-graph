# Settlement receipt contract

Feed F-3. A receipt carries the ledger posting ID and lists deliveries in arrival order.

Erratum F-8, signed off by the feed owner after R-12. A posting that has committed can temporarily have no receipt in the feed while the delivery queue catches up. If a receipt is absent, query the ledger by account and client key to establish whether the posting committed. The feed has no guaranteed delivery interval.
