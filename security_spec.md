# Security Specification for ShareItNow

## Data Invariants
1. A Post must have a valid `userId` matching the creator's UID.
2. A Like can only be created by an authenticated user for their own UID in the subcollection.
3. A Comment must have a valid `userId` matching the creator's UID.
4. `likesCount` on a Post must correspond to the number of documents in the `likes` subcollection (enforced via `getAfter` check on update).

## The Dirty Dozen Payloads (Targeted for Rejection)
1. **Identity Spoofing**: Create a post with `userId: "some_other_id"`.
2. **State Shortcutting**: Create a post with `likesCount: 999`.
3. **Ghost Field**: Update a post with `isAdmin: true`.
4. **ID Poisoning**: Create a post with an ID that is 2KB long.
5. **PII Leak**: Read another user's private data (if any existed).
6. **Self-Like Inflation**: Increment `likesCount` without creating a Like document.
7. **Negative Likes**: Decrement `likesCount` below 0.
8. **Comment Impersonation**: Post a comment with another user's `userId`.
9. **Caption Hijack**: Update someone else's post caption.
10. **Terminal State Break**: (Not applicable here yet, but status changes if we had them).
11. **Resource Poisoning**: Upload a 5MB base64 string as a caption.
12. **Unverified Auth**: Write data with a non-verified email (if `email_verified` is required).

## Test Runner (Conceptual)
All the above must return `PERMISSION_DENIED`.
