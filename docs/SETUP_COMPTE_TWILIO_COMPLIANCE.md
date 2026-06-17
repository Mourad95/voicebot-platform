# Création compte Twilio & conformité réglementaire (numéros FR)

Parcours administratif pour obtenir un numéro de téléphone **français (`+33`)** chez
Twilio, **avant** la partie technique (SIP Trunk + Retell, voir
[SETUP_TELEPHONIE_TWILIO_RETELL.md](./SETUP_TELEPHONIE_TWILIO_RETELL.md)).

> ⚠️ **C'est la partie la plus longue et la moins prévisible.** Elle implique des
> **validations humaines** côté Twilio (24h à 7 jours, parfois plus). À anticiper
> **bien avant** toute démo client.

---

## Vue d'ensemble du parcours

```
1. Créer le compte Twilio
2. Upgrade en compte "Full" (ajouter une carte de paiement)
3. Créer le Profil de Conformité principal (Primary Customer Profile)   ← validation humaine
4. Créer le Regulatory Bundle FR (justificatif d'adresse)               ← validation humaine
5. Acheter le numéro +33 (capacité Voice)
6. Assigner le bundle approuvé au numéro
7. → Passer à la config technique (SIP Trunk + Retell)
```

Chaque étape avec "validation humaine" peut **bloquer plusieurs jours**.

---

## Étape 1 — Création du compte

1. S'inscrire sur [twilio.com](https://www.twilio.com).
2. Vérifier l'email + le numéro de téléphone personnel.
3. Le compte démarre en mode **Trial** (crédit d'essai, restrictions).

> Le mode Trial limite fortement (numéros vérifiés uniquement, quota, mention
> "Trial" sur les appels). Il faut passer en **Full** pour un usage réel.

---

## Étape 2 — Upgrade en compte "Full"

1. **Console → Billing → Add payment method** (carte bancaire).
2. Recharger un montant initial.
3. Le compte passe en `type: Full`, `status: active`.

> Symptôme si oublié : `Trial over quota, please add payment` lors d'appels API.

Vérification API :
```bash
curl -s "https://api.twilio.com/2010-04-01/Accounts/AC<SID>.json" \
  -u "AC<SID>:<auth_token>" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['type'],d['status'])"
# Attendu : Full active
```

---

## Étape 3 — Profil de Conformité principal (Primary Customer Profile)

Depuis ~2024-2025, Twilio **exige un profil de conformité** sur le compte avant tout
achat de numéro.

1. **Console → Trust Hub → Customer Profiles → Create**.
2. Renseigner : entité (personne physique / société), nom, adresse, identité.
3. Soumettre → statut **In Review**.

> ⏱️ **Délai de validation : 24–72h en théorie, jusqu'à 5–7 jours** en période de
> forte charge. C'est une **validation humaine**.
>
> 🔴 **Tant que ce profil principal est "In Review", il peut bloquer le routage
> entrant de TOUS les numéros du compte**, même achetés et configurés.

Contact en cas de blocage : ouvrir un ticket support, ou
`numbers-regulatory-review@twilio.com`.

---

## Étape 4 — Regulatory Bundle FR (justificatif d'adresse)

Les numéros géographiques français sont soumis à la réglementation **ARCEP** : Twilio
exige un **Regulatory Bundle** prouvant une adresse en France.

1. **Console → Phone Numbers → Regulatory Compliance → Bundles → Create**.
2. Choisir : pays **France**, type de numéro **Local/Geographic**, usage.
3. Fournir les pièces demandées :
   - Justificatif d'identité.
   - **Justificatif d'adresse française** (facture, attestation, etc.).
4. Soumettre → statut **In Review** → puis **twilio-approved**.

> ⏱️ **Validation humaine.** On reçoit un email du type :
> *"Your Regulatory Bundle: <nom> has been approved. Please make sure that your
> approved Bundle is now assigned to your Phone Number(s)."*

Vérification API :
```bash
curl -s "https://numbers.twilio.com/v2/RegulatoryCompliance/Bundles" \
  -u "AC<SID>:<auth_token>" | python3 -c "import json,sys;[print(b['friendly_name'],b['status']) for b in json.load(sys.stdin)['results']]"
# Attendu : <nom_bundle>  twilio-approved
```

> ⚠️ **Ne pas confondre** le *Regulatory Bundle* (compliance d'adresse) avec le
> *SIP Trunk* — deux objets différents qui peuvent porter le même nom (ex.
> `flowcraft`). Le bundle est de la paperasse ; le trunk est de la config technique.

---

## Étape 5 — Achat du numéro +33

1. **Console → Phone Numbers → Buy a Number**.
2. Filtrer : **Country = France (+33)**, **Capabilities = Voice**.
3. 🔴 **Pour un numéro géographique FR, il faut souvent CHOISIR entre Voice et SMS** —
   les `+33 1...` ne supportent généralement **pas le SMS** (restriction réglementaire
   FR). Choisir **Voice** (l'agent vocal en a besoin).
4. À l'achat, le numéro peut exiger de **lier un bundle/adresse approuvé(e)**.

> 💡 **Pour le SMS** (notification à l'agent humain) : ne PAS chercher voix+SMS sur le
> même numéro FR. Utiliser un **sender SMS mutualisé** au niveau plateforme
> (sender ID alphanumérique, ou numéro mobile FR dédié, ou Vonage/Brevo). Voir la
> décision d'archi dans le code (`notifyAgent.ts` : 1 seul sender via `TWILIO_PHONE`).

Vérification API :
```bash
curl -s "https://api.twilio.com/2010-04-01/Accounts/AC<SID>/IncomingPhoneNumbers.json" \
  -u "AC<SID>:<auth_token>" | python3 -c "import json,sys;[print(n['phone_number'],n['capabilities'],n['status']) for n in json.load(sys.stdin)['incoming_phone_numbers']]"
```

---

## Étape 6 — Assigner le bundle approuvé au numéro

Une fois le bundle **twilio-approved**, il doit être **assigné au numéro** (souvent
automatique à l'achat, sinon manuel dans la fiche du numéro).

Vérification API (le `bundle_sid` du numéro doit pointer sur le bundle approuvé) :
```bash
curl -s "https://api.twilio.com/2010-04-01/Accounts/AC<SID>/IncomingPhoneNumbers/PN<SID>.json" \
  -u "AC<SID>:<auth_token>" | python3 -c "import json,sys;d=json.load(sys.stdin);print('bundle_sid:',d['bundle_sid']);print('address_sid:',d['address_sid']);print('emergency_status:',d['emergency_status'])"
```

---

## KYC (vérification d'identité) — pièges rencontrés

La vérification d'identité (KYC) peut bloquer la création/validation. Points vécus :

- 🔴 **CNI française souvent rejetée automatiquement** par les systèmes KYC US
  (mauvaise reconnaissance du format carte recto-verso). → **Préférer le passeport**,
  mieux reconnu.
- 🔴 **Une même pièce d'identité ne peut valider qu'UN compte** sur une plateforme
  donnée (Retell notamment). Réutiliser un ID déjà servi ailleurs peut déclencher un
  rejet. → En cas de blocage, demander une **vérification manuelle** au support en
  joignant recto+verso.
- En cas d'échec : `support@twilio.com` (ou `support@retellai.com` côté Retell),
  expliquer le contexte (démo urgente) et demander une revue manuelle.

---

## Modèle d'email support (escalade blocage)

> Subject: URGENT — Inbound routing not working on +33XXXXXXXXX, blocking client demo
>
> Hello,
>
> My French number +33XXXXXXXXX cannot receive inbound calls. Verified:
> - Number status "in-use", voice capability, attached to SIP trunk, origination
>   set to sip:sip.retellai.com.
> - Regulatory bundle BU... approved and assigned.
> - Zero inbound calls appear in my call logs (verified via API).
>
> This indicates inbound carrier routing is not yet activated. Please activate it
> urgently — it is blocking a client contract.
>
> Account: AC...
> Number SID: PN...

> Conseils : rester **factuel et chiffré** ("0 inbound calls in logs", "waiting X
> days"), **ne pas être agressif** (ça ralentit), ouvrir en priorité commerciale si
> le plan le permet, et **citer le numéro de ticket existant** pour ne pas repartir
> de zéro.

---

## Récapitulatif des délais & validations humaines

| Étape | Validation humaine ? | Délai typique |
|---|---|---|
| Création compte | Non | Immédiat |
| Upgrade Full (carte) | Non | Immédiat |
| Profil de conformité principal | **Oui** | 24h–7 jours |
| Regulatory Bundle FR | **Oui** | 24h–7 jours |
| KYC identité | **Oui** (si déclenché) | quelques heures–jours |
| Achat numéro | Non (si bundle prêt) | Immédiat |
| Activation routage entrant carrier | parfois | jusqu'à plusieurs jours |

> 👉 **À anticiper : compter ~1 à 2 semaines** entre la création du compte et un
> numéro FR pleinement opérationnel en réception. Ne jamais planifier une démo
> client sans cette marge.

---

## Étape suivante

Une fois le numéro acheté + bundle approuvé + routage actif :
→ **[SETUP_TELEPHONIE_TWILIO_RETELL.md](./SETUP_TELEPHONIE_TWILIO_RETELL.md)** (SIP Trunk + Retell).
