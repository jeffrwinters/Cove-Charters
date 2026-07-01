# Captain Image Cropping Plan

## Status
Planned implementation path for captain headshots.

## Problem
The public captain cards previously used a wide hero-style image crop. This does not work well for headshots because source photos vary widely: boat photos, torso shots, selfies, and portrait crops all frame differently.

The preferred path is to support admin-controlled image cropping/focal positioning.

## Component Assets

New reusable assets:

- `assets/admin-image-cropper.css`
- `assets/admin-image-cropper.js`

These provide a lightweight crop/focal-position UI for admin image editing.

## Data Model

Captain records should support one canonical headshot image and crop settings.

Recommended fields:

```json
{
  "photoUrl": "https://...",
  "photoFocalX": 50,
  "photoFocalY": 30,
  "photoZoom": 1.15
}
```

Use `photoUrl` as the canonical image field if possible.

If legacy fields exist, normalize in the UI/API from:

- `headshotUrl`
- `imageUrl`
- `avatarUrl`

into `photoUrl`.

## Admin Requirements

Captain admin should allow staff to:

- Upload a captain headshot.
- Preview the current image.
- Adjust horizontal focus.
- Adjust vertical focus.
- Adjust zoom.
- Save crop settings with the captain record.
- Replace or remove the image.

## Public Display Requirements

Public captain cards should render the image using the saved crop settings.

Example:

```html
<div
  class="captain-avatar"
  style="--photo:url(...); --photo-x:50%; --photo-y:30%; --photo-zoom:1.15"
></div>
```

The public CSS should use those values for object/background positioning so the card displays consistently.

## Fallback

If no captain image exists:

- Show initials avatar.
- Do not show an empty gradient square as if it were a missing image.
- The initials fallback should look intentional and premium.

## Codex Implementation Notes

After completing `docs/11 Required First Step - Admin Refactor.md`, wire the cropper into the captain editor as part of the work from `docs/12 Captain Images Requirement.md`.

Use:

```html
<link rel="stylesheet" href="assets/admin-image-cropper.css">
<script src="assets/admin-image-cropper.js"></script>
```

Example:

```js
const cropper = new AdminImageCropper(document.getElementById('captainPhotoCropper'), {
  imageUrl: captain.photoUrl,
  focalX: captain.photoFocalX || 50,
  focalY: captain.photoFocalY || 30,
  zoom: captain.photoZoom || 1.15,
  onChange: value => {
    captain.photoFocalX = value.focalX;
    captain.photoFocalY = value.focalY;
    captain.photoZoom = value.zoom;
  }
});
```

## Validation

Verify:

- Existing captains without images show initials fallback.
- Captains with images show real photos.
- Admin can upload/replace/remove image.
- Admin can adjust focus and zoom.
- Saved crop settings persist after reload.
- Public captain cards honor saved crop settings.
- Mobile card layout still works.
