#!/usr/bin/env bash
#
# backup.sh - Exemplo de rotina de backup/restauracao do MongoDB (Requisito 5).
#
# IMPORTANTE: este script e um EXEMPLO/REFERENCIA. A estrategia de backup e
# continuidade DEPENDE DE ACESSO A INFRAESTRUTURA (MongoDB Atlas / Render) que
# nao faz parte deste repositorio de codigo. Em producao, prefira os backups
# CONTINUOS automaticos + Point-in-Time Recovery do MongoDB Atlas. Use este
# script apenas como copia logica adicional (ex.: snapshot pontual antes de uma
# migracao) ou em ambientes self-hosted.
#
# Pre-requisitos: mongodb-database-tools (mongodump/mongorestore) instalados.
#
# Uso:
#   MONGO_URI="mongodb+srv://..." ./scripts/backup.sh dump
#   MONGO_URI="mongodb+srv://..." ./scripts/backup.sh restore ./backups/2026-06-10T12-00-00
#
set -euo pipefail

ACTION="${1:-dump}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"

if [[ -z "${MONGO_URI:-}" ]]; then
  echo "ERRO: defina a variavel de ambiente MONGO_URI." >&2
  exit 1
fi

case "${ACTION}" in
  dump)
    TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%S)"
    OUT_DIR="${BACKUP_ROOT}/${TIMESTAMP}"
    mkdir -p "${OUT_DIR}"
    echo "Gerando dump em ${OUT_DIR} ..."
    # --gzip reduz o tamanho; --oplog garante consistencia em replica sets.
    mongodump --uri="${MONGO_URI}" --gzip --out="${OUT_DIR}"
    echo "Backup concluido: ${OUT_DIR}"
    ;;

  restore)
    SRC_DIR="${2:-}"
    if [[ -z "${SRC_DIR}" || ! -d "${SRC_DIR}" ]]; then
      echo "ERRO: informe o diretorio do backup. Ex.: restore ./backups/2026-06-10T12-00-00" >&2
      exit 1
    fi
    echo "Restaurando a partir de ${SRC_DIR} ..."
    # ATENCAO: --drop apaga as colecoes antes de restaurar. Use com cuidado.
    mongorestore --uri="${MONGO_URI}" --gzip --drop "${SRC_DIR}"
    echo "Restauracao concluida."
    ;;

  *)
    echo "Acao desconhecida: ${ACTION}. Use 'dump' ou 'restore <dir>'." >&2
    exit 1
    ;;
esac
