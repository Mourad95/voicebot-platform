#!/usr/bin/env python3
"""
Emma Outbound Caller — Initie des appels sortants via l'API Retell AI (v2)
pour les leads qualifiés de Flowcraft.

Lit la base de leads, filtre par score et ancienneté de contact,
puis appelle l'API Retell pour chaque lead retenu.

Usage:
    python scripts/emma-outbound-caller.py --dry-run
    python scripts/emma-outbound-caller.py --limit 5 --min-score 8
    python scripts/emma-outbound-caller.py --limit 3

Variables d'environnement requises:
    RETELL_API_KEY            – clé API Retell
    RETELL_OUTBOUND_AGENT_ID  – ID de l'agent Retell à utiliser
    TWILIO_PHONE              – numéro source (caller ID) Twilio
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RETELL_API_URL = "https://api.retellai.com/v2/create-phone-call"
LEADS_DB_PATH = "~/flowcraft_leads_database.json"
LOG_PATH = "~/emma_outbound_log.jsonl"
DEFAULT_MIN_SCORE = 7
CALL_DELAY_SECONDS = 2
RECENT_CONTACT_DAYS = 30
REQUEST_TIMEOUT = 30  # seconds


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _expand(path):
    """Expand ~ and return absolute path."""
    return os.path.expanduser(path)


def log_message(msg):
    """Écrit un message horodaté sur stderr (ne pollue pas stdout)."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{timestamp}] {msg}\n")


def load_leads(db_path):
    """Charge les leads depuis le fichier JSON. Retourne la liste 'all'."""
    with open(db_path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("all", [])


def is_recent_contact(last_contact_str, cooldown_days):
    """Renvoie True si last_contact est dans les <cooldown_days> derniers jours.

    last_contact_str doit être une date ISO 8601 (ex: '2026-06-20T10:00:00').
    Si absent ou invalide, retourne False (le lead est considéré comme joignable).
    """
    if not last_contact_str:
        return False
    try:
        dt = datetime.fromisoformat(last_contact_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return False
    age = datetime.now(timezone.utc) - dt
    return age < timedelta(days=cooldown_days)


def format_phone_fr(raw_phone):
    """Formate un numéro français en format international +33.

    Retourne None si le numéro est masqué (*), vide, ou injoignable.
    """
    if not raw_phone or raw_phone == "?":
        return None
    # Numéro masqué : contient des astérisques
    if "*" in raw_phone:
        return None
    # Extrait les chiffres uniquement
    digits = "".join(ch for ch in raw_phone if ch.isdigit())
    if len(digits) < 10:
        return None
    # 0X XX XX XX XX → +33X...
    if len(digits) == 10 and digits.startswith("0"):
        return "+33" + digits[1:]
    # 33XXXXXXXXX → +33...
    if digits.startswith("33") and 11 <= len(digits) <= 12:
        return "+" + digits
    # Déjà en +33
    if digits.startswith("33") and len(digits) > 12:
        return "+" + digits
    # Fallback : prend les 9 derniers chiffres (numéro local sans le 0)
    if len(digits) >= 10:
        return "+33" + digits[-9:]
    return None


def make_retell_call(from_number, to_number, agent_id, api_key):
    """Appelle l'API Retell pour créer un appel sortant.

    Retourne un tuple (status_code: int, response_body: str).
    status_code = 0 signifie une erreur réseau (URLError).
    """
    payload = json.dumps(
        {
            "from_number": from_number,
            "to_number": to_number,
            "override_agent_id": agent_id,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        RETELL_API_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, body
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8")
    except urllib.error.URLError as exc:
        return 0, str(exc.reason)


def log_attempt(log_path, entry):
    """Ajoute une ligne JSON au journal des tentatives."""
    os.makedirs(os.path.dirname(_expand(log_path)) or ".", exist_ok=True)
    with open(_expand(log_path), "a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Emma Outbound Caller – Appels sortants Retell pour leads qualifiés."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Affiche ce qui serait fait sans appeler l'API.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Nombre maximum d'appels à initier (défaut: aucun).",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=DEFAULT_MIN_SCORE,
        help=f"Score minimum pour sélectionner un lead (défaut: {DEFAULT_MIN_SCORE}).",
    )
    parser.add_argument(
        "--contact-cooldown",
        type=int,
        default=RECENT_CONTACT_DAYS,
        help=(
            "Nombre de jours de cooldown après un contact récent "
            f"(défaut: {RECENT_CONTACT_DAYS})."
        ),
    )

    args = parser.parse_args()

    # --- Chargement des variables d'environnement ---
    api_key = os.environ.get("RETELL_API_KEY")
    agent_id = os.environ.get("RETELL_OUTBOUND_AGENT_ID")
    from_number = os.environ.get("TWILIO_PHONE")

    missing = []
    if not api_key:
        missing.append("RETELL_API_KEY")
    if not agent_id:
        missing.append("RETELL_OUTBOUND_AGENT_ID")
    if not from_number:
        missing.append("TWILIO_PHONE")

    if missing:
        if args.dry_run:
            log_message(
                f"ATTENTION: Variables d'environnement manquantes (dry-run OK) : "
                f"{', '.join(missing)}"
            )
        else:
            log_message(
                f"ERREUR: Variables d'environnement manquantes : "
                f"{', '.join(missing)}"
            )
            sys.exit(1)

    # --- Chargement des leads ---
    db_path = _expand(LEADS_DB_PATH)
    if not os.path.isfile(db_path):
        log_message(f"ERREUR: Base de leads introuvable : {db_path}")
        sys.exit(1)

    leads = load_leads(db_path)
    log_message(f"Leads chargés : {len(leads)} au total")

    # --- Filtrage ---
    filtered = []
    skipped_score = 0
    skipped_recent = 0
    skipped_phone = 0

    for lead in leads:
        score = lead.get("score", 0)
        if score < args.min_score:
            skipped_score += 1
            continue

        # Exclure les groupes/franchises — ne cibler QUE les indépendants
        lead_type = lead.get("type", "")
        priority = lead.get("priority", "")
        if lead_type == "group" or priority == "exclude":
            skipped_score += 1
            continue

        last_contact = lead.get("last_contact")
        if is_recent_contact(last_contact, args.contact_cooldown):
            skipped_recent += 1
            continue

        phone = format_phone_fr(lead.get("phone", ""))
        if phone is None:
            skipped_phone += 1
            continue

        # Attache le numéro formaté pour usage ultérieur
        lead["_formatted_phone"] = phone
        filtered.append(lead)

    log_message(
        f"Filtrage : {len(filtered)} retenu(s), "
        f"{skipped_score} score insuffisant, "
        f"{skipped_recent} contact récent, "
        f"{skipped_phone} téléphone invalide"
    )

    if len(filtered) == 0:
        log_message("Aucun lead éligible. Arrêt.")
        sys.exit(0)

    # --- Application de la limite ---
    if args.limit is not None and args.limit < len(filtered):
        filtered = filtered[: args.limit]
        log_message(f"Limité à {args.limit} appel(s)")

    # --- Appels ---
    log_file = _expand(LOG_PATH)
    success_count = 0
    fail_count = 0

    for idx, lead in enumerate(filtered):
        phone = lead["_formatted_phone"]
        name = lead.get("name", "Inconnu")
        score = lead.get("score", 0)
        timestamp = datetime.now(timezone.utc).isoformat()

        if args.dry_run:
            # dry-run : affichage sur stdout autorisé
            print(f"[DRY-RUN] #{idx + 1} {name} (score={score}) → {phone}")
            log_attempt(
                log_file,
                {
                    "timestamp": timestamp,
                    "lead_name": name,
                    "phone": phone,
                    "score": score,
                    "status": "dry_run",
                    "message": "Would have called",
                },
            )
            success_count += 1

        else:
            log_message(f"Appel #{idx + 1}/{len(filtered)} : {name} → {phone}")
            status_code, response_body = make_retell_call(
                from_number, phone, agent_id, api_key
            )

            call_ok = 200 <= status_code < 300
            if call_ok:
                success_count += 1
                log_message(f"  ✓ Succès (HTTP {status_code})")
            else:
                fail_count += 1
                log_message(
                    f"  ✗ Échec (HTTP {status_code}) : {response_body[:200]}"
                )

            log_attempt(
                log_file,
                {
                    "timestamp": timestamp,
                    "lead_name": name,
                    "phone": phone,
                    "score": score,
                    "status": "success" if call_ok else "failed",
                    "http_status": status_code,
                    "response": response_body[:500],
                },
            )

        # Délai entre deux appels (sauf après le dernier)
        if idx < len(filtered) - 1 and not args.dry_run:
            time.sleep(CALL_DELAY_SECONDS)

    # --- Résumé ---
    if args.dry_run:
        print(
            f"\nRésumé dry-run : {success_count} appel(s) simulé(s) "
            f"sur {len(filtered)} lead(s) éligible(s)."
        )
    else:
        log_message(
            f"Terminé. {success_count} succès, {fail_count} échec(s) "
            f"sur {len(filtered)} appel(s)."
        )

    if fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
