# Permissions Matrix Integration Test Cases

## Scope
These test cases validate end-to-end behavior from UI interaction to database persistence and back to UI state for RBAC permission matrix management.

## Preconditions
- API server is running.
- Client app is running.
- Test user is logged in as a role allowed to manage RBAC matrix.
- At least two non-SUPER_ADMIN roles exist.
- Permission records exist for multiple resources/actions.

## Case 1: Save And Refresh Persistence
1. Open Permissions page.
2. Change one matrix cell (example: role A, resource X, action read) from current scope to a different scope.
3. Click Save Changes.
4. Wait for success toast.
5. Hard refresh browser.
6. Verify changed cell still shows saved scope.
7. Verify `GET /rbac/permission-matrix` response includes same scope for that role/resource/action.
Expected:
- Saved value persists in UI after refresh.
- API response and UI are consistent.

## Case 2: Failed Save Rollback (Network/API Failure)
1. Open Permissions page.
2. Change at least one matrix cell.
3. Simulate save failure (disable network or force API 500 for `PUT /rbac/permission-matrix`).
4. Click Save Changes.
5. Verify error toast appears.
6. Verify matrix reverts to last known server state.
7. Refresh browser and confirm no unintended updates were persisted.
Expected:
- Clear error feedback is shown.
- Unsaved optimistic/draft change does not remain displayed as persisted.
- Server state remains source of truth.

## Case 3: Stale Cache Invalidation After Save
1. Open Permissions page in tab A and tab B.
2. In tab A, change a matrix cell and save.
3. In tab B, refresh Permissions page.
4. Verify tab B shows updated server value.
5. In tab A, verify matrix remains consistent with latest server state after save completion.
Expected:
- Save triggers cache invalidation/refetch behavior.
- UI reflects fresh server data, not stale cache.

## Case 4: Concurrent Toggle Handling During Save
1. Open Permissions page.
2. Change multiple matrix cells.
3. Click Save Changes.
4. While save request is in flight, attempt to edit any matrix select and click Save again.
Expected:
- Matrix controls are disabled during save.
- Duplicate submits are prevented.
- Exactly one save operation applies for that request cycle.

## Case 5: Rapid Toggling Before Save
1. Open Permissions page.
2. Toggle the same matrix cell quickly across multiple scopes.
3. Stop on final desired scope.
4. Save.
5. Refresh browser.
Expected:
- Final selected scope is persisted.
- No intermediate scope persists accidentally.

## Case 6: Save With No Changes
1. Open Permissions page.
2. Do not modify any matrix cell.
3. Confirm Save button is disabled.
Expected:
- No request is sent.
- No false success/error feedback appears.

## Case 7: Seeded Permission Update Compatibility
1. Ensure role has legacy seeded dot-format permission for a resource/action.
2. Open Permissions page and verify it displays non-none scope for that cell.
3. Change scope and save.
4. Refresh browser.
Expected:
- Existing seeded permissions are displayed correctly in matrix.
- Updated scope persists and remains visible after refresh.

## Case 8: Authorize Regression Safety Check
1. Set role/resource/action scope to none in matrix.
2. Login as user with that role.
3. Attempt protected read/write endpoint requiring that permission.
Expected:
- Access is denied (403).
- UI does not show unauthorized data/actions.

## Evidence Checklist
- Network traces for GET/PUT matrix calls.
- DB snapshot before/after save for role_permission rows.
- Screenshot/video of refresh persistence.
- Error path screenshot for rollback behavior.
