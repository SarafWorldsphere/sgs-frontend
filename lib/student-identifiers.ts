export const STUDENT_ACCESS_DENIED =
  'You are not authorized to access the Student dashboard. Please contact your school administrator.';

// Roll this new access rule out to SSS only. The same service also serves SGS,
// whose existing admission policy must not change as part of this release.
export function studentAccessSql(role: string): string {
  return role === 'Student'
    ? " AND (tenant_id <> 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid OR (COALESCE(roll_no::text, '') ~ '[^[:space:]]' AND COALESCE(admission_no::text, '') ~ '[^[:space:]]'))"
    : '';
}
