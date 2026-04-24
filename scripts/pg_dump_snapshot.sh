#!/usr/bin/env sh
set -e

TS=$(date +"%Y%m%d-%H%M%S")
OUT_DIR="./infra/postgres/snapshots"
OUT_FILE="${OUT_DIR}/mtc_db_${TS}.dump"

mkdir -p "$OUT_DIR"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-mtc}"
PGDATABASE="${PGDATABASE:-mtc_db}"
PGPASSWORD="${PGPASSWORD:-mtc_password}"

export PGPASSWORD

pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -Fc "$PGDATABASE" -f "$OUT_FILE"
echo "snapshot created: $OUT_FILE"

