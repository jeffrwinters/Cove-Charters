# Cove Charters TODO

## Customer-Facing Fleet UX

### Preserve fleet scroll position when returning from boat details

When a customer drills into a boat detail page from the Fleet page and then selects **Back to Fleet**, restore the Fleet page so the boat they opened is still in the viewport.

**Example behavior**

- Customer scrolls to **Brima** in the fleet list.
- Customer opens Brima's boat detail page.
- Customer clicks **Back to Fleet**.
- Fleet page returns with **Brima** still visible, instead of jumping back to the top.

**Implementation notes**

- Store the selected boat ID and/or current scroll position before navigating to the detail page.
- On return to Fleet, wait for the boat list to render, then scroll the previously selected boat card into view.
- Use saved scroll position as a fallback if the boat element cannot be found.
- Clear the saved state when the user starts a new browse session or navigates away intentionally.
