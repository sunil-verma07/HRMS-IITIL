# Employee Module Permission And UX Integration Test Cases

## Scope
These tests validate end-to-end behavior for employee create/edit/delete UX, permission-gated controls, route protection, and backend enforcement from live database permissions.

## Preconditions
- API server and client are running.
- At least one SUPER_ADMIN user and one non-super-admin role user exist.
- Permissions matrix changes can be saved by SUPER_ADMIN.
- Test users have active sessions before each scenario unless stated.

## Case 1: Create Button Opens Modal
1. Login as user with employee write or manage permission.
2. Open Employee Management page.
3. Click Create employee.
Expected:
- Employee form modal opens.
- No click handler errors in browser console.

## Case 2: Create Employee Success Flow
1. Open Create employee modal.
2. Enter valid required fields.
3. Submit once.
Expected:
- Submit button shows loading state.
- Double submit is prevented while loading.
- Success toast appears.
- Modal closes on success.
- Employee list is refreshed and new employee appears.

## Case 3: Create Employee Failure Flow
1. Open Create employee modal.
2. Enter data that forces API failure (for example duplicate email).
3. Submit.
Expected:
- Error toast appears.
- Modal stays open.
- Entered form data remains intact.
- User can correct and resubmit.

## Case 4: Form Validation Inline Errors
1. Open Create employee modal.
2. Leave required fields empty.
3. Submit.
Expected:
- Inline field errors are shown.
- No API request is sent.

## Case 5: Edit Button Visibility By Permission
1. Login as user with employee read only.
2. Open Employee Management page.
Expected:
- Edit action is not visible.
3. Login as user with employee write or manage.
Expected:
- Edit action is visible for allowed rows.

## Case 6: Delete Button Visibility By Permission
1. Login as user with employee write only and without manage/delete scope.
2. Open Employee Management page.
Expected:
- Delete action is hidden.
3. Login as user with employee manage or delete scope.
Expected:
- Delete action is visible for allowed rows.

## Case 7: Delete Confirmation Flow
1. Login as user with delete permission.
2. Click Delete on a row.
Expected:
- Confirmation dialog opens.
3. Confirm deletion.
Expected:
- Loading state appears in dialog.
- Exactly one delete request is sent.
- Success toast appears and list refreshes.

## Case 8: Employee Page Hidden With Zero Employee Permissions
1. Login as role with zero employee module permissions in DB.
2. Observe sidebar.
Expected:
- Employee Management entry is not visible.

## Case 9: Direct URL Access Blocked
1. Login as role with zero employee module permissions.
2. Navigate directly to /employees.
Expected:
- User is redirected away immediately.
- Protected content is not rendered.

## Case 10: Immediate Revocation Without Re-Login
1. User A logs in as role R and accesses employee APIs successfully.
2. SUPER_ADMIN revokes role R employee permission in permissions matrix and saves.
3. User A sends next employee API request without logging out.
Expected:
- Request is denied with 403.
- No server restart or re-login is required.

## Case 11: Immediate Grant Without Re-Login
1. User B logs in as role R lacking employee permission.
2. SUPER_ADMIN grants role R required employee permission and saves.
3. User B sends next employee API request.
Expected:
- Request is allowed on next request cycle.

## Case 12: Last Write Wins For Concurrent Matrix Edits
1. Admin A and Admin B open permissions matrix.
2. Both change same role-resource-action cell to different scopes.
3. Save A then save B.
Expected:
- Final DB state matches last successful save.
- Subsequent matrix reload reflects final state.
