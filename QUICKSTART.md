# ⚡ QuickStart - 5 Minutes

Lancer le voicebot localement avec webhooks HTTPS.

---

## 📋 En 5 Commandes

### 1️⃣ Préparer l'Environnement

```bash
# Copier le template .env
cp .env.example .env

# Éditer .env avec vos clés API
# nano .env
# (Retell API key, MongoDB URI, Twilio, etc.)
```

### 2️⃣ Démarrer MongoDB (Docker)

MongoDB est géré via Docker Compose — pas besoin de l'installer localement.

> ⚠️ **Si tu as `mongodb-community` installé via Homebrew**, il faut l'arrêter sinon il prend le port 27017 et empêche Docker de fonctionner :
> ```bash
> brew services stop mongodb-community
> ```

```bash
make mongo
```

### 3️⃣ Installer Dépendances Node

```bash
npm install
```

### 4️⃣ Démarrer le Serveur (Terminal 1)

```bash
npm run dev

# Attend de voir:
# 🚀 Serveur démarré - port 3000
```

### 5️⃣ Créer un Tunnel HTTPS (Terminal 2)

```bash
# Installer ngrok (une seule fois)
brew install ngrok

# Créer le tunnel
ngrok http 3000

# Copier l'URL: https://abc123.ngrok.io
```

---

## 🎯 Configurer Retell

### Mettre à Jour Emma.json

Modifiez `Assistant Immobilier — Emma.json`, ligne ~670:

```json
"default_dynamic_variables": {
  ...
  "webhook_url": "https://abc123.ngrok.io",  // ← Votre URL ngrok
  "agency_id": "your_uuid",
  ...
}
```

### Ou via Dashboard Retell

1. Allez à https://retell.ai/dashboard
2. Sélectionnez Emma
3. Settings → Webhooks
4. Mettez à jour l'URL vers: `https://abc123.ngrok.io/webhook/retell`

---

## 🧪 Tester

```bash
# Health check
curl http://localhost:3000/health
# → {"status": "ok", ...}

# Test webhook
curl -X POST https://abc123.ngrok.io/webhook/retell \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "get_agency_info", "args": {"agencyId": "emma"}}'
# → {"result": {"success": true, ...}}
```

---

## 📞 Appeler Emma

1. Via Retell Dashboard → Test/Live
2. Ou appelez le numéro français configuré dans Retell
3. Regardez les logs du Terminal 1 pour voir les webhooks arriver

---

## 📊 Monitorer

### Logs du Serveur (Terminal 1)

```
[RETELL] Appel reçu - tool: get_agency_info - 2025-05-22T14:30:00Z
[RETELL] call_started - call_id: call_123...
[RETELL] call_ended - call_id: call_123...
```

### Inspecteur ngrok

Allez à: http://localhost:4040
Vous verrez tous les webhooks reçus!

---

## 🗄️ Base de Données

```bash
# Ouvrir MongoDB shell
mongosh

# Voir les appels/prospects
use voicebot
db.prospects.find().pretty()

# Sortir
exit
```

---

## 🆘 Problèmes Courants

| Problème | Solution |
|----------|----------|
| "MongoDB connection failed" | `brew services stop mongodb-community && make mongo` |
| "Authentication failed" (Compass) | MongoDB Homebrew tourne sur le port 27017 → `brew services stop mongodb-community` |
| "Webhook unreachable" | Vérifiez ngrok: `ngrok http 3000` |
| "Port 3000 already in use" | `lsof -i :3000` → kill le process |
| "Signature verification failed" | Normal en dev (NODE_ENV=development) |

---

## ✅ Checklist

- [ ] `.env` créé et complété
- [ ] MongoDB démarré
- [ ] `npm run dev` en cours (Terminal 1)
- [ ] `ngrok http 3000` en cours (Terminal 2)
- [ ] Emma.json `webhook_url` mis à jour
- [ ] `curl` health check OK
- [ ] Appel test vers Emma fonctionne

---

## 🎓 Docs Complètes

Pour plus de détails: **`README_LOCAL_SETUP.md`**

Enjoy! 🚀
