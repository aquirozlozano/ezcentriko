BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, company_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS areas_company_name ON areas(company_id, lower(name));
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_area_company_fk') THEN
    ALTER TABLE users ADD CONSTRAINT users_area_company_fk
      FOREIGN KEY (area_id, company_id) REFERENCES areas(id, company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_id_company_unique') THEN
    ALTER TABLE reports ADD CONSTRAINT reports_id_company_unique UNIQUE (id, company_id);
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS area_reports (
  area_id INTEGER NOT NULL,
  report_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  PRIMARY KEY (area_id, report_id),
  FOREIGN KEY (area_id, company_id) REFERENCES areas(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (report_id, company_id) REFERENCES reports(id, company_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS users_area_idx ON users(area_id);

-- Preserve each existing user's exact permissions without sharing their access
-- with other users. Administrators can rename or consolidate these initial areas.
DO $$ DECLARE member RECORD; new_area INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_areas') THEN
    FOR member IN SELECT u.id, u.company_id FROM users u
      JOIN roles r ON r.id = u.role_id WHERE r.name <> 'administrador' AND u.area_id IS NULL
    LOOP
      INSERT INTO areas(company_id, name)
        VALUES(member.company_id, 'Acceso inicial ' || member.id) RETURNING id INTO new_area;
      UPDATE users SET area_id = new_area WHERE id = member.id;
      INSERT INTO area_reports(area_id, report_id, company_id)
        SELECT new_area, r.id, r.company_id FROM report_permissions p
        JOIN reports r ON r.id = p.report_id
        WHERE p.user_id = member.id AND r.company_id = member.company_id;
    END LOOP;
    INSERT INTO schema_migrations(version) VALUES ('001_areas');
  END IF;
END $$;
COMMIT;
