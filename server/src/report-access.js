// Always resolve membership from the database so changes affect existing sessions.
// Parameters: $1 company, $2 user, $3 current role. Reports must be aliased as r.
export const reportAccess = `r.company_id = $1 AND (
  $3::text = 'administrador' OR EXISTS (
    SELECT 1 FROM users u JOIN area_reports ar
      ON ar.area_id = u.area_id AND ar.company_id = u.company_id
    WHERE u.id = $2 AND u.company_id = $1 AND ar.report_id = r.id
  )
)`;
export const accessParams = (user) => [user.company_id, user.id, user.role];
