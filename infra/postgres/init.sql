-- PostgreSQL initialization script for InCollect

-- Create test database
CREATE DATABASE incollect_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE incollect_dev TO incollect;
GRANT ALL PRIVILEGES ON DATABASE incollect_test TO incollect;

-- Enable UUID extension
\c incollect_dev
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c incollect_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
