# Captain Images Requirement

## Status
Planned requirement for the Admin Refactor and UX Merge work.

## Purpose
Captains need image support similar to boats, but simpler. Public captain pages and admin captain records should support a captain headshot/profile image.

## Requirement
During the admin refactor and UX merge, add support for captain images.

## Admin Requirements

Captain admin records should support:

- Upload captain headshot/profile photo.
- Preview current captain image in the captain detail editor.
- Replace existing captain image.
- Remove captain image if needed.
- Save image reference with the captain record.

## Public Requirements

Public-facing captain cards/pages should use the captain image when available.

If no image exists, use a clean fallback such as:

- Initials avatar
- Branded Cove placeholder
- Neutral captain silhouette/card treatment

## Data Model Notes

Preferred field names:

- `photoUrl`
- or `headshotUrl`

Use one canonical field consistently across API, admin, and public pages.

Existing code may already check multiple possible fields such as:

- `photoUrl`
- `headshotUrl`
- `imageUrl`
- `avatarUrl`

Codex should normalize this to one preferred field if possible.

## Storage Notes

Use the same image upload/storage approach already used for boat media if practical.

Captain images do not need gallery ordering. MVP only needs one primary image per captain.

## Validation

Verify:

- Captain image can be uploaded.
- Captain image preview appears in admin.
- Captain image persists after save/reload.
- Captain image appears on public captain cards.
- Missing image gracefully falls back to initials or placeholder.
- Existing captain save/delete behavior still works.

## Codex Handoff

When running the admin refactor and UX merge, include this as part of the implementation scope:

```text
Also implement captain image support using docs/12 Captain Images Requirement.md. Use one canonical image field, preferably photoUrl or headshotUrl, wire upload/preview/remove behavior into captain admin, and display the image on public captain cards with a fallback when missing.
```

## Related References

- `docs/11 Required First Step - Admin Refactor.md`
- `docs/10 Codex Implementation Prompt - Admin UX Merge.md`
- `captains.html`
- `admin.html`
