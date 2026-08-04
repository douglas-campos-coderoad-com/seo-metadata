.PHONY: help dev test build gen-client clean install lint format

help:
	@echo "InCollect Development Commands"
	@echo "==============================="
	@echo "make dev           - Start local development (Docker Compose)"
	@echo "make test          - Run all tests (backend + frontend)"
	@echo "make test-backend  - Run backend tests"
	@echo "make test-frontend - Run frontend tests"
	@echo "make build         - Build frontend and backend for production"
	@echo "make gen-client    - Generate TypeScript client from OpenAPI schema"
	@echo "make lint          - Run linters (backend + frontend)"
	@echo "make format        - Format code (backend + frontend)"
	@echo "make install       - Install all dependencies"
	@echo "make clean         - Clean up build artifacts and caches"

# Development
dev:
	@echo "Starting local development environment..."
	docker-compose up -d
	@echo "✓ Services running:"
	@echo "  - Frontend: http://localhost:3000"
	@echo "  - Backend API: http://localhost:8000"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - MailHog: http://localhost:1025"

# Dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Testing
test: test-backend test-frontend
	@echo "✓ All tests passed"

test-backend:
	@echo "Running backend tests..."
	cd backend && pytest --cov=src tests/

test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test

test-e2e:
	@echo "Running E2E tests..."
	cd frontend && npm run e2e

# API Client Generation
gen-client:
	@echo "Generating TypeScript client from OpenAPI schema..."
	@echo "Note: Run backend first to generate /openapi.json"
	@echo "Then: npx openapi-typescript http://localhost:8000/openapi.json -o packages/api-client/src/types.ts"

# Code Quality
lint:
	@echo "Running backend linting..."
	cd backend && mypy src && ruff check src && black --check src
	@echo "Running frontend linting..."
	cd frontend && npm run lint

format:
	@echo "Formatting backend code..."
	cd backend && black src && ruff check --fix src
	@echo "Formatting frontend code..."
	cd frontend && npx prettier --write src

# Build
build:
	@echo "Building backend..."
	cd backend && python -m py_compile src/**/*.py
	@echo "Building frontend..."
	cd frontend && npm run build

# Cleanup
clean:
	@echo "Cleaning up..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf backend/build backend/dist backend/*.egg-info
	rm -rf frontend/.next frontend/out frontend/build
	rm -rf coverage .pytest_cache .mypy_cache .ruff_cache
	@echo "✓ Cleanup complete"

# Docker
docker-down:
	docker-compose down

docker-clean:
	docker-compose down -v
	@echo "✓ All containers and volumes removed"

# Database
db-migrate:
	@echo "Running database migrations..."
	cd backend && alembic upgrade head

db-rollback:
	@echo "Rolling back last migration..."
	cd backend && alembic downgrade -1

db-seed:
	@echo "Seeding database..."
	cd backend && python -c "from src.db.init_db import init_db; init_db()"
