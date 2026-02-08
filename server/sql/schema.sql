CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- Permisos por reporte
CREATE TABLE IF NOT EXISTS report_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, report_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orchestrations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  destinations TEXT NOT NULL,
  cron TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Lima',
  status TEXT NOT NULL DEFAULT 'activo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_access_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE RESTRICT,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos de prueba (idempotentes)
INSERT INTO roles (name)
SELECT 'administrador'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'administrador'
);

INSERT INTO roles (name)
SELECT 'visitante'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE name = 'visitante'
);

INSERT INTO companies (company_name)
SELECT 'Centriko'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE company_name = 'Centriko'
);

INSERT INTO companies (company_name)
SELECT 'Orion Foods'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE company_name = 'Orion Foods'
);

INSERT INTO users (company_id, role_id, name, email, password_hash)
SELECT c.id, r.id, 'Admin Centriko', 'admin@centriko.local', crypt('Admin123!', gen_salt('bf'))
FROM companies c
JOIN roles r ON r.name = 'administrador'
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@centriko.local');

INSERT INTO users (company_id, role_id, name, email, password_hash)
SELECT c.id, r.id, 'Operador Centriko', 'ops@centriko.local', crypt('Ops123!', gen_salt('bf'))
FROM companies c
JOIN roles r ON r.name = 'visitante'
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'ops@centriko.local');

INSERT INTO users (company_id, role_id, name, email, password_hash)
SELECT c.id, r.id, 'Admin Orion', 'admin@orion.local', crypt('Admin123!', gen_salt('bf'))
FROM companies c
JOIN roles r ON r.name = 'administrador'
WHERE c.company_name = 'Orion Foods'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@orion.local');

INSERT INTO reports (company_id, user_id, name, embed_url)
SELECT u.company_id, u.id, 'Ventas Mensuales', 'https://app.powerbi.com/reportEmbed?reportId=demo-ventas'
FROM users u
WHERE u.email = 'admin@centriko.local'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'Ventas Mensuales'
      AND user_id = u.id
  );

INSERT INTO reports (company_id, user_id, name, embed_url)
SELECT u.company_id, u.id, 'Inventario', 'https://app.powerbi.com/groups/me/reports/eff21341-4863-435e-a975-597a06cc6320/7783bc3b30a546217865?experience=power-bi'
FROM users u
WHERE u.email = 'admin@centriko.local'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'Inventario'
      AND user_id = u.id
  );

INSERT INTO reports (company_id, user_id, name, embed_url)
SELECT u.company_id, u.id, 'KPIs Operativos', 'https://app.powerbi.com/groups/me/reports/eff21341-4863-435e-a975-597a06cc6320/7783bc3b30a546217865?experience=power-bi'
FROM users u
WHERE u.email = 'admin@orion.local'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'KPIs Operativos'
      AND user_id = u.id
  );


  -- Dar permiso inicial al dueño del reporte
--INSERT INTO report_permissions (user_id, report_id)
--SELECT user_id, id FROM reports
--ON CONFLICT DO NOTHING;