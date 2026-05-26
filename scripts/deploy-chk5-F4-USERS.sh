#!/usr/bin/env bash
# scripts/deploy-chk5-F4-USERS.sh
# chk5.F4-USERS (2026-05-26) · Deploy interactivo paso a paso del módulo /usuarios v2.
#
# Pasos:
#   0. Pre-checks (gcloud · firebase CLI · estar en el directorio correcto)
#   1. Backup Firestore (gcloud firestore export)
#   2. DRY-RUN migración (no escribe)
#   3. LIVE migración (escribe en /users · idempotente)
#   4. Deploy Firestore rules
#   5. Deploy 12 Cloud Functions nuevas
#   6. Mensaje de validación E2E (smoke test manual)
#
# Cada paso pide confirmación · podés saltear con flag --auto.
# Si algo falla · script aborta · NO continúa al siguiente paso.

set -euo pipefail

# ─── COLORS ──────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# ─── CONFIG ──────────────────────────────────────────────────────────────
PROJECT_ID="businessmn-269c9"
BUCKET="gs://businessmn-269c9.appspot.com/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="${BUCKET}/pre-f4-users-${TIMESTAMP}"

CF_LIST=(
  "inviteUser"
  "cancelInvitation"
  "resendInvitation"
  "approveUser"
  "rejectUser"
  "acceptInvitation"
  "validateSelfSignup"
  "completarSelfSignup"
  "desconectarSesion"
  "desconectarTodasSesiones"
  "desconectarTodasSistema"
  "scheduledAutoRejectExpired"
)

# ─── AUTO MODE ───────────────────────────────────────────────────────────
AUTO_MODE=false
if [[ "${1:-}" == "--auto" ]]; then
  AUTO_MODE=true
  echo -e "${YELLOW}⚠ AUTO MODE · cada paso se ejecuta sin confirmación${NC}"
fi

# ─── HELPERS ─────────────────────────────────────────────────────────────
banner() {
  echo ""
  echo -e "${PURPLE}════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${PURPLE}  $1${NC}"
  echo -e "${PURPLE}════════════════════════════════════════════════════════════════════${NC}"
}

step() {
  echo ""
  echo -e "${BLUE}▶ $1${NC}"
}

ok() {
  echo -e "${GREEN}✓ $1${NC}"
}

fail() {
  echo -e "${RED}✗ $1${NC}"
  exit 1
}

confirm() {
  if [[ "$AUTO_MODE" == "true" ]]; then return 0; fi
  echo ""
  read -p "$(echo -e ${YELLOW}$1 \(y/n\): ${NC})" -n 1 -r
  echo ""
  [[ $REPLY =~ ^[Yy]$ ]]
}

# ════════════════════════════════════════════════════════════════════════
# PASO 0 · PRE-CHECKS
# ════════════════════════════════════════════════════════════════════════
banner "PASO 0 · Pre-checks"

step "Verificando directorio del proyecto..."
if [[ ! -f "firebase.json" || ! -f "package.json" ]]; then
  fail "Este script debe correrse desde la raíz del proyecto businessmn-v2"
fi
ok "Directorio correcto: $(pwd)"

step "Verificando gcloud CLI..."
if ! command -v gcloud &> /dev/null; then
  fail "gcloud no instalado · instalar desde https://cloud.google.com/sdk/docs/install"
fi
gcloud config set project "$PROJECT_ID" --quiet 2>/dev/null
ok "gcloud OK · proyecto: $PROJECT_ID"

step "Verificando firebase CLI..."
if ! command -v firebase &> /dev/null; then
  fail "firebase CLI no instalado · npm install -g firebase-tools"
fi
firebase use "$PROJECT_ID" --quiet 2>/dev/null || true
ok "firebase CLI OK · proyecto: $PROJECT_ID"

step "Verificando que functions/ tenga deps instaladas..."
if [[ ! -d "functions/node_modules" ]]; then
  echo -e "${YELLOW}  Instalando dependencies de functions/...${NC}"
  (cd functions && npm install --silent)
fi
ok "functions/node_modules presente"

step "Verificando env vars de Cloud Functions..."
if [[ ! -f "functions/.env" ]]; then
  fail "functions/.env no existe · ver TURNSTILE_SECRET_KEY · RESEND_API_KEY · JWT_SECRET"
fi
for var in "TURNSTILE_SECRET_KEY" "RESEND_API_KEY" "JWT_SECRET" "EMAIL_FROM"; do
  if ! grep -q "^${var}=" functions/.env; then
    fail "functions/.env falta variable: $var"
  fi
done
ok "functions/.env con todas las env vars necesarias"

# ════════════════════════════════════════════════════════════════════════
# PASO 1 · BACKUP FIRESTORE
# ════════════════════════════════════════════════════════════════════════
banner "PASO 1 · Backup Firestore"
echo "Path destino: ${BACKUP_PATH}"

if confirm "¿Crear backup Firestore?"; then
  step "Exportando Firestore a ${BACKUP_PATH}..."
  gcloud firestore export "$BACKUP_PATH" --quiet
  ok "Backup completo: $BACKUP_PATH"
else
  echo -e "${YELLOW}  Backup saltado · proceder bajo tu responsabilidad${NC}"
fi

# ════════════════════════════════════════════════════════════════════════
# PASO 2 · DRY-RUN MIGRACIÓN
# ════════════════════════════════════════════════════════════════════════
banner "PASO 2 · DRY-RUN migración users → v2 schema"

step "Ejecutando dry-run (NO escribe nada)..."
node scripts/migrate-users-v2.mjs --dry-run

echo ""
echo -e "${YELLOW}Revisá la tabla arriba · cada user · qué se le va a agregar.${NC}"
echo -e "${YELLOW}Si todo OK, confirmás abajo para la migración LIVE.${NC}"

# ════════════════════════════════════════════════════════════════════════
# PASO 3 · LIVE MIGRACIÓN
# ════════════════════════════════════════════════════════════════════════
banner "PASO 3 · LIVE migración"

if confirm "¿Ejecutar migración LIVE? (escribe en /users · idempotente)"; then
  step "Ejecutando migración..."
  node scripts/migrate-users-v2.mjs
  ok "Migración completa"
else
  fail "Abortado por el usuario · backup en ${BACKUP_PATH}"
fi

# ════════════════════════════════════════════════════════════════════════
# PASO 4 · FIRESTORE RULES
# ════════════════════════════════════════════════════════════════════════
banner "PASO 4 · Deploy Firestore rules"

if confirm "¿Deploy firestore.rules?"; then
  step "Desplegando reglas..."
  firebase deploy --only firestore:rules
  ok "Rules desplegadas"
else
  echo -e "${YELLOW}  Rules saltadas${NC}"
fi

# ════════════════════════════════════════════════════════════════════════
# PASO 5 · CLOUD FUNCTIONS
# ════════════════════════════════════════════════════════════════════════
banner "PASO 5 · Deploy 12 Cloud Functions nuevas"

echo "Funciones a desplegar:"
for fn in "${CF_LIST[@]}"; do
  echo "  · $fn"
done

if confirm "¿Deploy las 12 functions?"; then
  step "Construyendo functions/..."
  (cd functions && npm run build)
  ok "Build OK"

  step "Desplegando functions..."
  # Build comma-separated list of functions:name
  ONLY_ARG=$(printf "functions:%s," "${CF_LIST[@]}")
  ONLY_ARG=${ONLY_ARG%,}  # Remove trailing comma
  firebase deploy --only "$ONLY_ARG"
  ok "12 functions desplegadas"
else
  echo -e "${YELLOW}  Functions saltadas${NC}"
fi

# ════════════════════════════════════════════════════════════════════════
# PASO 6 · SMOKE TEST E2E (manual)
# ════════════════════════════════════════════════════════════════════════
banner "PASO 6 · Smoke test E2E (manual · ~15 min)"

echo ""
echo -e "${GREEN}🎉 Deploy completo del módulo /usuarios v2${NC}"
echo ""
echo "Próximo paso: smoke test manual end-to-end."
echo ""
echo "Checklist:"
echo "  [ ] npm run dev  → abrir http://localhost:5178"
echo "  [ ] Login con tu cuenta admin existente"
echo "  [ ] Ir a /usuarios → ver shell con 5 sub-tabs"
echo "  [ ] Click 'Ficha 360' en una card → ver modal flotante con 5 tabs"
echo "  [ ] Click 'Invitar por email' → llenar email tuyo · enviar"
echo "  [ ] Revisar bandeja de entrada · email de invitación llegó"
echo "  [ ] Click el link del email → /setup-password/:id se abre"
echo "  [ ] Tab Configuración → cambiar política a 'Solo invitación' · guardar"
echo "  [ ] Logout · abrir /signup en incognito · captcha Turnstile aparece"
echo "  [ ] Click '¿Olvidaste?' en /login → /forgot-password funciona"
echo ""
echo "Si todo OK · chk5.F4-USERS está LIVE en producción 🚀"
echo ""
echo -e "${BLUE}Backup en: ${BACKUP_PATH}${NC}"
echo -e "${BLUE}Si necesitás rollback: gcloud firestore import ${BACKUP_PATH}${NC}"
echo ""
