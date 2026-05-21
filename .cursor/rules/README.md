# Cursor Rules — Mourad Aumar

Structure modulaire `.cursor/rules/*.mdc` (format moderne Cursor 2026+).
Remplace l'ancien fichier monolithique `.cursorrules`.

## Pourquoi ce découpage

L'ancien `.cursorrules` chargeait TOUTES les règles à chaque conversation, même pour des tâches qui n'en ont rien à faire (token tax). Avec `.cursor/rules/`, chaque règle a un **scope** :

| Mode             | Quand ça se charge                                              |
|------------------|-----------------------------------------------------------------|
| `alwaysApply`    | Chaque conversation (à garder court — token tax)                |
| `globs`          | Auto quand un fichier matchant est ouvert/édité                 |
| `description`    | Cursor décide selon la tâche en cours (agent-requested)         |
| Manuel `@nom`    | Uniquement si tu l'invoques explicitement avec `@nom-rule`      |

## Fichiers générés

### Toujours chargés (essentiel uniquement)
- **`core.mdc`** — comportement de l'agent, limites strictes, format de réponse
- **`interdictions.mdc`** — liste des "PAS de..." (rappels critiques)

### Auto-attach par glob (chargés quand pertinents)
- **`typescript.mdc`** — `**/*.ts`, `**/*.tsx` — règles strictes TS
- **`react.mdc`** — `**/*.tsx`, `**/components/**` — composants, hooks, state
- **`nextjs.mdc`** — `**/app/**`, `next.config.*` — App Router, RSC, Server Actions
- **`nestjs.mdc`** — `**/*.controller.ts`, `**/*.service.ts`, `**/*.module.ts` — DI, guards, DTOs
- **`angular.mdc`** — `**/*.component.ts`, `angular.json` — standalone, signals, OnPush
- **`nodejs.mdc`** — `**/server/**`, `**/api/**`, controllers — async, validation, sécu
- **`testing.mdc`** — `**/*.spec.ts`, `**/*.test.ts`, `__tests__/**` — TDD pragmatique
- **`devops.mdc`** — `Dockerfile*`, `.gitlab-ci.yml`, `.github/workflows/**` — Docker, CI, AWS

### Agent-requested (Cursor décide selon la tâche)
- **`architecture.mdc`** — SOLID, Clean Architecture, DDD
- **`clean-code.mdc`** — DRY, KISS, YAGNI, fonctions courtes
- **`naming.mdc`** — conventions de nommage (TS, Python, Git)
- **`git-workflow.mdc`** — Conventional Commits, branches, PR
- **`database.mdc`** — MongoDB, Postgres, Prisma, perf queries
- **`ai-llm.mdc`** — RAG, agents, MCP, prompts, sécu IA

## Installation

```bash
# À la racine de ton projet
mkdir -p .cursor/rules
# Copie tous les .mdc dedans
cp -r chemin/vers/.cursor/rules/* .cursor/rules/
# Commit
git add .cursor/rules
git commit -m "chore: add cursor rules"
```

## Vérification

Dans Cursor : `Cmd+Shift+P` → `Cursor Settings` → `Rules`.
Tu verras la liste des règles détectées et leur scope.

## Maintenance

- **Quand tu te surprends à reprendre Cursor 3x sur la même chose** : ajoute la règle dans le fichier concerné.
- **Quand une règle ne déclenche jamais de correction** : supprime-la (elle bouffe du contexte pour rien).
- **Si une `alwaysApply` devient trop longue** : passe-la en agent-requested avec une bonne `description`.

## Pour invoquer manuellement une règle

Dans le chat Cursor : `@architecture` ou `@ai-llm` force le chargement de cette règle pour la conversation, même si Cursor ne l'aurait pas chargée automatiquement.
