# Configuration téléphonie : Twilio → SIP Trunk → Retell

Guide complet pour brancher un numéro de téléphone Twilio sur un agent vocal Retell,
via un **Elastic SIP Trunk**. C'est la méthode qui fonctionne (le `voice_url` webhook
direct vers `twilio-voice-webhook/{agent_id}` ne marche PAS — il renvoie 404).

> **Architecture du flux d'appel entrant (inbound)** — le cas d'usage principal :
>
> ```
> Client compose le numéro
>   → Réseau téléphonique (PSTN)
>   → Twilio reçoit l'appel (le numéro lui appartient)
>   → Le numéro est rattaché au SIP Trunk
>   → Origination du Trunk route vers  sip:sip.retellai.com
>   → Retell reconnaît le numéro (importé avec son termination_uri)
>   → L'agent assigné (Emma) décroche
>   → (en parallèle) Retell appelle les tools en HTTP sur notre serveur Node
> ```
>
> Le serveur Node n'intervient JAMAIS dans le flux voix (SIP). Il ne reçoit que les
> webhooks HTTP de Retell (tool calls, events) sur `/webhook/retell*`.

---

## Valeurs de référence (config actuelle qui fonctionne)

| Élément | Valeur |
|---|---|
| Compte Twilio (SID) | `AC...` (voir console Twilio) |
| Numéro FR | `+33XXXXXXXXX` |
| Numéro SID | `PN...` (voir console Twilio) |
| SIP Trunk (région Ireland IE1) | `TK...` (voir Elastic SIP Trunking) |
| Termination SIP URI | `<nom-trunk>.pstn.twilio.com` |
| Origination SIP URI (Retell) | `sip:sip.retellai.com` |
| IP ACL Retell | `18.98.16.120/30` (friendly name : `retell`) |
| Agent Retell (Emma v2) | `agent_...` (voir dashboard Retell) |
| Regulatory Bundle (compliance FR) | `BU...` (voir Regulatory Compliance) |

> ⚠️ **Important** : la clé API Retell et le workspace doivent correspondre.
> Le numéro est dans le workspace de la clé `RETELL_API_KEY` du `.env` de prod.
> Si la clé pointe sur un autre workspace, l'agent ID ne sera pas reconnu.

---

## Prérequis

1. **Numéro acheté chez Twilio** avec capacité **Voice** (les numéros géographiques
   FR `+33 1...` ne supportent pas le SMS — c'est normal).
2. **Regulatory Bundle approuvé** (justificatif d'adresse FR). Sans ça, le numéro
   ne reçoit pas d'appels. Statut visible dans
   *Phone Numbers → Regulatory Compliance → Bundles* → doit être `twilio-approved`.
3. **Agent Retell créé** et son `agent_id` noté.

---

## PARTIE 1 — Twilio : créer et configurer le SIP Trunk

> La partie la plus importante et la plus piégeuse. Suis l'ordre exactement.

### Étape 1.1 — Créer le Trunk

Console Twilio → **Elastic SIP Trunking → Trunks → Create new SIP Trunk**

- **Friendly name** : `flowcraft`
- **Region / Home Region** : choisir **Ireland (IE1)** pour la latence FR/EU.
  ⚠️ La région du trunk doit être cohérente partout (voir Étape 1.2 Routing).

### Étape 1.2 — Onglet **Termination** (trafic SORTANT : Retell → PSTN)

Requis pour les appels sortants ET pour valider le trunk.

1. **Termination SIP URI** : saisir `flowcraft` → donne `flowcraft.pstn.twilio.com`
2. **Routing → Regional** : vérifier que la région choisie (ex. *Ireland (IE1)*)
   est **Active**.
   - 🔴 **PIÈGE** : si le routing régional est **Inactive**, le trunk ne route pas.
     C'est ce qui bloquait — il a fallu activer/modifier le trunk de la bonne région.
3. **Authentication → IP Access Control Lists** : ajouter une ACL nommée `retell`
   contenant le bloc IP de Retell :
   - **IP address** : `18.98.16.120`
   - **CIDR prefix length** : `30`
   - (équivaut à `18.98.16.120/30`)

> L'IP ACL n'est strictement requise que pour le **sortant** (termination).
> Mais on la met systématiquement pour que le trunk soit complet et valide.

### Étape 1.3 — Onglet **Origination** (trafic ENTRANT : PSTN → Retell)

**C'est CE qui fait décrocher l'agent sur un appel entrant.**

1. **Add Origination URI**
2. **Origination SIP URI** : `sip:sip.retellai.com`
3. **Priority** : `10` — **Weight** : `10` — **Enabled** : ✔

### Étape 1.4 — Onglet **Numbers**

1. **Add a number** → sélectionner `+33XXXXXXXXX`
2. Cela rattache le numéro au trunk.

### Étape 1.5 — 🔴 Retirer le `voice_url` du numéro (PIÈGE CRITIQUE)

Un numéro rattaché à un trunk **ne doit PAS** avoir de Voice webhook URL en parallèle,
sinon Twilio envoie l'inbound vers le webhook (souvent un 404) au lieu du trunk.

Console Twilio → **Phone Numbers → Active Numbers → +33XXXXXXXXX → Voice Configuration**

- Le menu **"Configure with"** doit être sur **SIP Trunk** (et pointer sur `flowcraft`),
  **PAS** sur *Webhook*.
- Si un ancien webhook traîne (ex. `https://api.retellai.com/twilio-voice-webhook/...`),
  le supprimer / basculer sur SIP Trunk.

> Vérif API : `voice_url` doit être vide une fois le numéro routé par le trunk.

---

## PARTIE 2 — Retell : importer le numéro

Le numéro doit être **importé** dans Retell (pas saisi en "Custom telephony" manuel),
avec le `termination_uri` du trunk, pour que Retell associe l'appel entrant à l'agent.

### Option A — Via API (recommandé, reproductible)

```bash
curl -X POST "https://api.retellai.com/import-phone-number" \
  -H "Authorization: Bearer $RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+33XXXXXXXXX",
    "termination_uri": "flowcraft.pstn.twilio.com",
    "inbound_agent_id": "agent_...",
    "nickname": "flowcraft demo"
  }'
```

Réponse attendue : objet contenant `inbound_agent_id` et
`sip_outbound_trunk_config.termination_uri = flowcraft.pstn.twilio.com`.

> Si erreur `Phone number already exists` alors que `list-phone-numbers` est vide :
> le numéro est dans un **autre workspace**. Vérifier que `$RETELL_API_KEY`
> correspond bien au workspace où vit l'agent.
>
> Pour repartir propre : `DELETE https://api.retellai.com/delete-phone-number/+33XXXXXXXXX`
> puis ré-importer.

### Option B — Via le dashboard Retell

**Phone Numbers → +** → connecter le numéro en fournissant le `termination_uri`
`flowcraft.pstn.twilio.com`, puis assigner l'agent en **Inbound Call Agent**.

### Assignation de l'agent

Sur la page du numéro dans Retell :
- **Inbound Call Agent** → sélectionner l'agent (Emma v2).
- **Allowed Inbound Countries** → `France`.
- (Optionnel) **Outbound Call Agent** si on veut émettre des appels.

---

## PARTIE 3 — Vérification

### 3.1 — Côté Twilio (API)

```bash
AUTH="AC...:<auth_token>"

# Le numéro doit être lié au trunk et SANS voice_url
curl -s "https://api.twilio.com/2010-04-01/Accounts/AC.../IncomingPhoneNumbers/PN....json" \
  -u "$AUTH" | python3 -c "import json,sys;d=json.load(sys.stdin);print('trunk_sid:',d['trunk_sid']);print('voice_url:',d['voice_url'])"
# Attendu : trunk_sid = TK...  /  voice_url = None (ou vide)
```

### 3.2 — Côté Retell (API)

```bash
curl -s "https://api.retellai.com/list-phone-numbers" \
  -H "Authorization: Bearer $RETELL_API_KEY"
# Attendu : +33XXXXXXXXX avec inbound_agent_id correct + termination flowcraft.pstn.twilio.com
```

### 3.3 — Test réel

Appeler le `+33XXXXXXXXX` depuis un téléphone → l'agent doit décrocher.
Vérifier l'appel dans **Retell → Call History** et **Twilio → Voice → Call logs**.

---

## Dépannage (symptômes rencontrés et causes)

| Symptôme | Cause | Fix |
|---|---|---|
| Webhook `twilio-voice-webhook/{id}` renvoie **404** | Endpoint inexistant / méthode obsolète | Utiliser un **SIP Trunk**, pas un voice_url webhook |
| Appel `Busy`, durée 0 (visible dans Twilio) | Numéro a un `voice_url` qui répond 404, prioritaire sur le trunk | Basculer le numéro en **SIP Trunk** (Partie 1.5) |
| Sonne dans le vide, **0 appel** dans les logs Twilio | Routing régional du trunk **Inactive**, ou mauvais trunk | Activer le routing régional / utiliser le bon trunk (IE1) |
| `Phone number already exists` mais liste Retell vide | Numéro dans un **autre workspace** | Utiliser la clé API du bon workspace |
| Agent ID "introuvable" / tools en 401 | Clé API prod = mauvais workspace | Mettre la clé du workspace de l'agent dans `RETELL_API_KEY` |
| Tools d'Emma échouent en prod (401 signature) | `RETELL_API_KEY` serveur ≠ workspace de l'agent | Aligner la clé + redémarrer le conteneur |

---

## Récapitulatif : les 3 pièges qui ont coûté du temps

1. **Le voice_url webhook direct ne marche pas** (404). → SIP Trunk obligatoire.
2. **Le routing régional du trunk était Inactive** (mauvais trunk / mauvaise région).
   → Il a fallu modifier le trunk de la bonne région (IE1) avec routing Active.
3. **Deux workspaces Retell** avec des `agent_id` différents. → La clé API doit
   correspondre au workspace où vit l'agent et où le numéro est importé.
