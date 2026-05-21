.DEFAULT_GOAL := help

DOCKER_COMPOSE := docker compose
SECTOR ?= immo
PORT ?= 3000

ifneq (,$(wildcard .env))
  include .env
  export
endif

MONGODB_URI ?= mongodb://voicebot:change_me_dev_password@127.0.0.1:27017/voicebot?authSource=admin
MONGODB_URI_DOCKER := $(subst 127.0.0.1,mongo,$(subst localhost,mongo,$(MONGODB_URI)))

.PHONY: help install mongo up down logs ps build dev start seed seed-docker \
	api api-build api-rebuild api-logs api-stop

help: ## Affiche les commandes disponibles
	@echo "Commandes Make — voicebot-platform"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Variables: SECTOR=$(SECTOR)  PORT=$(PORT)"
	@echo "Mongo: MONGODB_URI (local → 127.0.0.1, docker seed → mongo)"

install: ## Installe les dépendances npm
	npm ci

mongo: ## Démarre MongoDB (Docker, port 27017, auth)
	$(DOCKER_COMPOSE) up -d mongo

up: ## Démarre toute la stack Docker (app + mongo)
	$(DOCKER_COMPOSE) up -d --build

api: mongo ## Démarre l'API Docker seule (mongo requis, sans rebuild)
	$(DOCKER_COMPOSE) up -d app

api-build: ## Build l'image Docker de l'API
	$(DOCKER_COMPOSE) build app

api-rebuild: mongo ## Rebuild l'image API (no-cache) et redémarre le conteneur
	$(DOCKER_COMPOSE) build --no-cache app
	$(DOCKER_COMPOSE) up -d --force-recreate app

api-logs: ## Logs du conteneur API uniquement
	$(DOCKER_COMPOSE) logs -f app

api-stop: ## Arrête le conteneur API (laisse Mongo tourner)
	$(DOCKER_COMPOSE) stop app

down: ## Arrête toute la stack Docker
	$(DOCKER_COMPOSE) down

logs: ## Suit les logs de toute la stack Docker
	$(DOCKER_COMPOSE) logs -f

ps: ## Statut des conteneurs Docker
	$(DOCKER_COMPOSE) ps

build: ## Compile TypeScript
	npm run build

dev: mongo ## Serveur en dev (tsx watch, lit MONGODB_URI depuis .env)
	npm run dev

start: build ## Serveur compilé (node dist, lit MONGODB_URI depuis .env)
	npm run start

seed: mongo ## Seed DB depuis le Mac (SECTOR=immo par défaut)
	SECTOR=$(SECTOR) npm run seed

seed-docker: mongo ## Seed dans le réseau Docker (hostname mongo)
	@NETWORK=$$(docker inspect -f '{{range $$k, $$v := .NetworkSettings.Networks}}{{$$k}}{{end}}' $$($(DOCKER_COMPOSE) ps -q mongo)); \
	docker run --rm \
	  -v "$(CURDIR):/app" -w /app \
	  --network "$$NETWORK" \
	  --env-file .env \
	  -e MONGODB_URI=$(MONGODB_URI_DOCKER) \
	  -e SECTOR=$(SECTOR) \
	  node:22-alpine \
	  sh -c "npm ci && npm run seed"
