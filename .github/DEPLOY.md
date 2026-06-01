# Pipeline GitHub Actions

## Workflows

| Workflow | Déclencheur | Rôle |
|----------|-------------|------|
| **CI** | Push/PR sur `main` et `staging` | `npm ci` → `type-check` → `build` |
| **Deploy Staging** | Push sur `staging` | SSH → `make deploy-preprod` |
| **Deploy Production** | Push sur `main` | SSH → `make deploy-prod` |

## Ce que fait chaque cible Make

| Cible | Description |
|-------|-------------|
| `make deploy-prod` | `git reset --hard origin/main` + `make rebuild-api` |
| `make deploy-preprod` | `git reset --hard origin/staging` + `make rebuild-api` |
| `make rebuild-api` | `docker compose build --no-cache app` + `docker compose up -d --force-recreate app` |

MongoDB reste intact (volume `mongodb_data` jamais supprimé).

## Secrets GitHub à configurer

Settings → Secrets and variables → Actions

### Production (`main`)

| Secret | Exemple |
|--------|---------|
| `SSH_HOST_PROD` | `1.2.3.4` |
| `SSH_USER_PROD` | `ubuntu` |
| `SSH_PRIVATE_KEY_PROD` | Contenu complet de `~/.ssh/id_rsa` |
| `DEPLOY_PATH_PROD` | `/home/ubuntu/voicebot-platform` |

### Staging (`staging`)

| Secret | Exemple |
|--------|---------|
| `SSH_HOST_STAGING` | `1.2.3.5` |
| `SSH_USER_STAGING` | `ubuntu` |
| `SSH_PRIVATE_KEY_STAGING` | Contenu complet de `~/.ssh/id_rsa` |
| `DEPLOY_PATH_STAGING` | `/home/ubuntu/voicebot-platform-staging` |

## Prérequis sur le serveur

```bash
# Packages
apt install git make docker.io docker-compose-plugin

# Cloner le repo
git clone <repo> /home/ubuntu/voicebot-platform
cd /home/ubuntu/voicebot-platform

# Configurer l'env
cp .env.example .env
nano .env  # remplir MONGO_USER, MONGO_PASSWORD, TWILIO_*, RETELL_API_KEY, etc.

# Premier démarrage (inclut Mongo)
make up

# Seed initial
make seed-docker
```

## Déploiement manuel

```bash
# Rebuild API sans toucher à Mongo
make rebuild-api

# Voir les logs
make api-logs

# Statut des conteneurs
make ps
```
