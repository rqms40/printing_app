# GRIDGO Monorepo — Common Commands
# Usage: make <command>

.PHONY: help mobile-dev mobile-test mobile-analyze server-dev server-test clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# === Mobile (Flutter) ===

mobile-dev: ## Run Flutter app in debug mode
	cd apps/mobile && fvm flutter run

mobile-test: ## Run Flutter tests
	cd apps/mobile && fvm flutter test

mobile-analyze: ## Run Flutter analyzer
	cd apps/mobile && fvm flutter analyze

mobile-build-apk: ## Build Android APK
	cd apps/mobile && fvm flutter build apk --release

mobile-build-web: ## Build web app
	cd apps/mobile && fvm flutter build web --release

mobile-clean: ## Clean Flutter build
	cd apps/mobile && fvm flutter clean && fvm flutter pub get

# === Server (NestJS) — Phase 3 ===

server-dev: ## Run NestJS in dev mode (auto-reload)
	cd server && npm run start:dev

server-test: ## Run NestJS tests
	cd server && npm test

server-build: ## Build NestJS for production
	cd server && npm run build

server-docker: ## Start PostgreSQL + Redis + MinIO
	cd server && docker-compose up -d

# === All ===

install: ## Install all dependencies
	cd apps/mobile && fvm flutter pub get
	@if [ -f server/package.json ]; then cd server && npm install; fi

test: ## Run all tests
	cd apps/mobile && fvm flutter test
	@if [ -f server/package.json ]; then cd server && npm test; fi

lint: ## Run all linters (check before push)
	cd apps/mobile && fvm flutter analyze lib/
	cd server && npm run lint:check

pre-push: lint test ## Full check before pushing (lint + test)
	@echo "✅ All checks passed — safe to push"

clean: ## Clean all build artifacts
	cd apps/mobile && fvm flutter clean
	@if [ -d server/dist ]; then rm -rf server/dist; fi
