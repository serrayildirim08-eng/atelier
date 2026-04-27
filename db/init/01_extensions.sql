-- Runs once on first container boot (the postgres image executes /docker-entrypoint-initdb.d/*.sql).
-- Subsequent boots skip this file because the data directory is already initialized.
CREATE EXTENSION IF NOT EXISTS vector;
