CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos de prueba (idempotentes)
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

INSERT INTO users (company_id, name, email, password_hash)
SELECT c.id, 'Admin Centriko', 'admin@centriko.local', crypt('Admin123!', gen_salt('bf'))
FROM companies c
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@centriko.local');

INSERT INTO users (company_id, name, email, password_hash)
SELECT c.id, 'Operador Centriko', 'ops@centriko.local', crypt('Ops123!', gen_salt('bf'))
FROM companies c
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'ops@centriko.local');

INSERT INTO users (company_id, name, email, password_hash)
SELECT c.id, 'Admin Orion', 'admin@orion.local', crypt('Admin123!', gen_salt('bf'))
FROM companies c
WHERE c.company_name = 'Orion Foods'
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@orion.local');

INSERT INTO reports (company_id, name, embed_url)
SELECT c.id, 'Ventas Mensuales', 'https://app.powerbi.com/reportEmbed?reportId=demo-ventas'
FROM companies c
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'Ventas Mensuales'
      AND company_id = c.id
  );

INSERT INTO reports (company_id, name, embed_url)
SELECT c.id, 'Inventario', 'https://app.powerbi.com/reportEmbed?reportId=demo-inventario'
FROM companies c
WHERE c.company_name = 'Centriko'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'Inventario'
      AND company_id = c.id
  );

INSERT INTO reports (company_id, name, embed_url)
SELECT c.id, 'KPIs Operativos', 'https://app.powerbi.com/reportEmbed?reportId=demo-kpis'
FROM companies c
WHERE c.company_name = 'Orion Foods'
  AND NOT EXISTS (
    SELECT 1 FROM reports
    WHERE name = 'KPIs Operativos'
      AND company_id = c.id
  );
