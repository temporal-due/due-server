.PHONY: setup dev dev-local down reset

setup: ## 최초 설정: .env 파일 생성
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✔ .env 파일이 생성됐습니다. 시크릿 값을 채워주세요."; \
	else \
		echo ".env 파일이 이미 존재합니다."; \
	fi

dev: ## 프론트 개발자용 — DB + 앱 전체 실행 (Docker)
	docker compose up --build

dev-local: ## 백엔드 개발자용 — DB만 Docker, 앱은 로컬 hot reload
	docker compose up due-local-postgres -d && pnpm start:dev

down: ## 전체 종료
	docker compose down

reset: ## DB 초기화 + 테스트 유저 시드
	pnpm dev:reset
