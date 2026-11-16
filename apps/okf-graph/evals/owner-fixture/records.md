# Settlement records

L-3, in effect. Each account has its own client-key namespace. Submitting the same key again normally returns the original posting so a repeat cannot move funds twice.

R-7, in effect. Archive batches use the standard submission endpoint. Verify the checksum, retain the input keys and approvals, and reconcile each returned posting ID. The worksheet sequence was unchanged at the last review.

L-14, accepted. A correction may reuse the account and client key as a new posting when the original period is sealed, the correction targets a different period, and a new correction voucher authorizes it. The original posting remains intact. The separate voucher gives auditors a distinct authorization trail. A correction entered directly at the desk and a correction arriving in an imported batch have the same terms. All other repeats still follow L-3.

P-6, pending. Accepting a filename as proof of authorization has been proposed. No change to the accepted terms has been approved.
