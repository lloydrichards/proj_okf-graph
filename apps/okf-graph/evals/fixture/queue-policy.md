# Queue policy

Accepted decision Q-12. Workers claim jobs in FIFO order within each tenant to keep replay predictable. Emergency replay uses the same ordering because it rebuilds per-tenant state. The runtime rejects jobs with no tenant ID before enqueueing.

Open question Q-19. Two retries and four retries are competing proposals. The team has not accepted a retry limit.
