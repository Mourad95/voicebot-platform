# 🚀 Setup Local - Voicebot Platform

Comment lancer le projet en local avec Retell/ElevenLabs webhooks HTTPS.

---

## 📋 Prérequis

- **Node.js** 18+ (vérifiez: `node --version`)
- **npm** ou **yarn**
- **MongoDB** (local ou Atlas cloud)
- **Un compte Retell** ou **ElevenLabs** (pour les webhooks)

---

## 🔧 Étape 1: Installation Locale

### 1.1 Cloner le Repo

```bash
git clone <votre-repo>
cd voicebot-platform
```

### 1.2 Installer les Dépendances

```bash
npm install
# ou
yarn install
```

### 1.3 Configuration `.env`

Créez un fichier `.env` à la racine du projet:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/voicebot
# Ou si vous utilisez MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/voicebot

# Retell Configuration
RETELL_API_KEY=your_retell_api_key_here

# ElevenLabs Configuration (optional for now)
# ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
# ELEVENLABS_AGENT_ID_IMMO=your_agent_id_here

# Server Configuration
PORT=3000
NODE_ENV=development
SECTOR=immo

# Twilio (for SMS notifications)
TWILIO_SID=your_twilio_account_sid
TWILIO_TOKEN=your_twilio_auth_token
TWILIO_PHONE=+33123456789
```

**Important**: Ne committez PAS ce fichier (`.env` est dans `.gitignore`)

---

## 🗄️ Étape 2: Setup MongoDB

### Option A: MongoDB Local (macOS)

```bash
# Installer MongoDB avec Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Démarrer MongoDB
brew services start mongodb-community

# Vérifier la connexion
mongosh
# Devrait vous ouvrir une shell MongoDB
exit
```

### Option B: MongoDB Atlas (Cloud)

1. Allez à https://www.mongodb.com/cloud/atlas
2. Créez un cluster gratuit
3. Obtenez la connection string: `mongodb+srv://user:password@...`
4. Mettez-la dans `.env` comme `MONGODB_URI`

---

## ⚡ Étape 3: Lancer le Serveur Local

### 3.1 En Mode Développement

```bash
npm run dev
```

Vous devriez voir:
```
🚀 Serveur démarré - port 3000 - sector immo - env development
```

### 3.2 Vérifier la Santé

```bash
curl http://localhost:3000/health
```

Réponse attendue:
```json
{
  "status": "ok",
  "timestamp": "2025-05-22T...",
  "env": "development",
  "sector": "immo"
}
```

---

## 🔐 Étape 4: IMPORTANT - Webhooks HTTPS Local

**Problème**: Retell/ElevenLabs exigent des webhooks `https://` (pas `http://`).
Mais votre localhost est juste `http://localhost:3000`.

**Solution**: Utilisez un **tunnel HTTPS** pour exposer votre localhost.

### 4.1 Utiliser `ngrok` (Recommandé)

**Installation**:

```bash
# Avec Homebrew (macOS)
brew install ngrok

# Ou télécharger: https://ngrok.com/download
```

**Utilisation**:

```bash
# Terminal 1: Démarrer le serveur
npm run dev

# Terminal 2: Créer un tunnel HTTPS vers localhost:3000
ngrok http 3000
```

Vous verrez:

```
Session Status                online
Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

**Votre URL HTTPS**: `https://abc123.ngrok.io`

### 4.2 Alternative: `cloudflared` (Cloudflare Tunnel)

```bash
# Installer
brew install cloudflare/cloudflare/cloudflared

# Créer un tunnel
cloudflared tunnel --url http://localhost:3000
```

Vous obtenez une URL comme: `https://something.trycloudflare.com`

### 4.3 Alternative: `local-ssl-proxy`

```bash
# Installer globalement
npm install -g local-ssl-proxy

# Créer un proxy HTTPS
local-ssl-proxy --source 3001 --target 3000
```

Puis utilisez: `https://localhost:3001`

---

## 🎯 Étape 5: Configurer Retell avec le Webhook Local

### 5.1 Obtenir votre URL HTTPS

À partir de l'étape 4, vous avez une URL comme:
```
https://abc123.ngrok.io
```

### 5.2 Mettre à Jour Emma.json

Dans `Assistant Immobilier — Emma.json`, changez:

```json
"default_dynamic_variables": {
  ...
  "webhook_url": "https://abc123.ngrok.io",  // ← Votre URL ngrok
  "agency_id": "your_agency_uuid",
  ...
}
```

Ou si vous utilisez l'API Retell, configurez les webhooks via le dashboard:
- Allez à: Agent Settings → Webhooks
- URL: `https://abc123.ngrok.io/webhook/retell`

### 5.3 Tester le Webhook

```bash
# Terminal: Vérifier que le webhook fonctionne
curl -X POST https://abc123.ngrok.io/webhook/retell \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_agency_info",
    "args": {"agencyId": "emma"},
    "call_id": "test_123"
  }'
```

Vous devriez voir une réponse JSON avec le résultat du tool.

---

## 📱 Étape 6: Tester Emma en Local

### 6.1 Via le Dashboard Retell

1. Allez à https://retell.ai/dashboard
2. Trouvez l'agent Emma
3. Dans "Test" ou "Live", cliquez "Call"
4. Appelez Emma
5. Les logs de votre serveur local (Terminal 1) doivent montrer les appels

### 6.2 Via Appel Réel

1. Configurez un numéro français dans Retell
2. Appelez le numéro
3. Parlez à Emma
4. Regardez les logs du serveur

---

## 📊 Étape 7: Monitoring des Webhooks

### 7.1 Logs du Serveur

```bash
# Terminal 1 (npm run dev) affiche les logs:
[RETELL] Appel reçu - tool: get_available_slots - 2025-05-22T...
[RETELL] call_started - call_id: ... - 2025-05-22T...
[RETELL] call_ended - call_id: ... - 2025-05-22T...
```

### 7.2 Inspecter les Payloads

Modifiez `src/core/routes/retell.ts` temporairement:

```typescript
retellRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  console.log('=== RETELL WEBHOOK ===')
  console.log('Body:', JSON.stringify(req.body, null, 2))
  
  // ... reste du code
})
```

Puis appelez Emma et regardez les logs.

### 7.3 Utiliser ngrok Web Inspector

ngrok fournit un web inspector:
```
http://localhost:4040
```

Vous verrez tous les webhooks reçus sur votre tunnel (requests/responses).

---

## 🗄️ Étape 8: Tester avec MongoDB Local

### 8.1 Vérifier les Données

```bash
# Ouvrir la shell MongoDB
mongosh

# Lister les databases
show dbs

# Utiliser la database voicebot
use voicebot

# Voir les prospects créés
db.prospects.find().pretty()

# Voir les agences
db.agencies.find().pretty()

# Voir les slots
db.slots.find().pretty()
```

### 8.2 Créer des Données de Test

```bash
# Dans mongosh:

# Créer une agence test
db.agencies.insertOne({
  uuid: "emma-test",
  slug: "emma",
  name: "Emma Test Agency",
  agentName: "Emma",
  agentPhone: "+33123456789",
  retellAgentId: "your_retell_agent_id",
  sector: "immo",
  isActive: true
})

# Créer des slots de test
db.slots.insertMany([
  {
    uuid: "slot-001",
    agencyId: ObjectId("..."), // ID de l'agence créée ci-dessus
    slotTime: new Date("2025-05-23T10:00:00Z"),
    isAvailable: true
  },
  {
    uuid: "slot-002",
    agencyId: ObjectId("..."),
    slotTime: new Date("2025-05-23T14:00:00Z"),
    isAvailable: true
  }
])
```

---

## 📝 Étape 9: Variables d'Environnement Complètes

```bash
# .env - Exemple Complet

# === DATABASE ===
MONGODB_URI=mongodb://localhost:27017/voicebot

# === RETELL ===
RETELL_API_KEY=your_api_key_here

# === ELEVENLABS (optionnel pour ElevenLabs migration) ===
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
# ELEVENLABS_AGENT_ID_IMMO=your_agent_id

# === SERVER ===
PORT=3000
NODE_ENV=development

# === SECTOR ===
SECTOR=immo

# === TWILIO (SMS notifications) ===
TWILIO_SID=your_account_sid
TWILIO_TOKEN=your_auth_token
TWILIO_PHONE=+33123456789

# === WEBHOOK (pour Emma.json) ===
# Si en local avec ngrok:
# WEBHOOK_URL=https://abc123.ngrok.io
```

---

## 🆘 Troubleshooting

### Problème: "MongoDB connection failed"

**Solution**:
```bash
# Vérifier que MongoDB est en cours d'exécution
brew services list | grep mongodb

# Redémarrer MongoDB
brew services restart mongodb-community

# Ou vérifier la connection string dans .env
echo $MONGODB_URI
```

### Problème: "Webhook URL not reachable"

**Causes possibles**:
1. ngrok est fermé → Redémarrez: `ngrok http 3000`
2. Serveur Node est down → Vérifiez: `npm run dev`
3. Firewall bloque → Vérifiez que port 3000 est libre

**Tester**:
```bash
# Depuis votre machine
curl https://abc123.ngrok.io/health

# Devrait retourner: {"status": "ok", ...}
```

### Problème: "Tool call timeout"

**Causes**:
1. Serveur pas accessible → Vérifiez ngrok
2. Tool execution lent → Vérifiez les logs: `npm run dev`
3. Database query échoue → Vérifiez MongoDB

**Logs**:
```bash
# Terminal 1 devrait montrer les erreurs:
npm run dev
# Regardez pour [ERROR], [WARN], etc.
```

### Problème: "signature verification failed" (Retell)

**En développement c'est normal!** La signature est ignorée.

Vérifiez dans `src/core/middleware/validateRetell.ts`:
```typescript
if (nodeEnv !== 'development') {
  // Signature verification - skipped in dev
}
```

---

## ✅ Checklist - Local Setup Complet

- [ ] Node.js 18+ installé (`node --version`)
- [ ] Dépendances installées (`npm install`)
- [ ] `.env` créé avec configuration
- [ ] MongoDB lancé (`brew services list`)
- [ ] Serveur démarre (`npm run dev`)
- [ ] Health check OK (`curl http://localhost:3000/health`)
- [ ] ngrok lancé (`ngrok http 3000`)
- [ ] URL HTTPS obtenue (ex: `https://abc123.ngrok.io`)
- [ ] Emma.json `webhook_url` mis à jour
- [ ] Test webhook réussit (`curl https://abc123.ngrok.io/webhook/retell`)
- [ ] Appel test via Retell fonctionne
- [ ] Logs affichent les appels
- [ ] MongoDB contient les données test

---

## 🚀 Workflow Quotidien

### Pour Travailler en Local:

**Terminal 1: Serveur Node**
```bash
npm run dev
# Garder ouvert, regarder les logs
```

**Terminal 2: Tunnel HTTPS**
```bash
ngrok http 3000
# Copier l'URL: https://abc123.ngrok.io
```

**Terminal 3: Travail normal**
```bash
# Éditez le code
# Serveur redémarre automatiquement (nodemon)
# Les webhooks arrivent via ngrok
```

**Bonus - Terminal 4: MongoDB (optionnel)**
```bash
mongosh
# Inspectez les données
db.prospects.find().pretty()
```

---

## 🔄 Déployer en Production

Une fois que tout fonctionne en local:

1. **Deploy le serveur** (Heroku, AWS, etc.)
2. **Mettez à jour** `webhook_url` dans Retell (URL production, pas ngrok)
3. **Testez** avec un vrai appel
4. **Monitorez** les logs de production

Mais **en local**, utilisez ngrok pour tester avant de pousser en prod!

---

## 📚 Fichiers Importants

```
voicebot-platform/
├── .env (à créer)
├── .env.example (template)
├── npm scripts (vérifiez package.json)
├── src/
│   ├── server.ts (point d'entrée)
│   ├── core/
│   │   ├── routes/retell.ts (webhooks Retell)
│   │   ├── routes/elevenlabs.ts (webhooks ElevenLabs)
│   │   └── middleware/validateRetell.ts
│   └── ...
└── Assistant Immobilier — Emma.json (config agent)
```

---

## 📖 Docs Utiles

- **Retell**: https://docs.retellai.com
- **ngrok**: https://ngrok.com/docs
- **MongoDB**: https://docs.mongodb.com
- **Node.js**: https://nodejs.org/docs

---

## ✨ Prêt?

1. Créez `.env` (copie de `.env.example`)
2. Démarrez MongoDB
3. `npm run dev` dans Terminal 1
4. `ngrok http 3000` dans Terminal 2
5. Testez Emma! 🎤

**Questions?** Regardez les logs (`npm run dev`) - ils sont détaillés!
