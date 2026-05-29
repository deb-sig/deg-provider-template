#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEG_BIN="${DEG_BIN:-double-entry-generator}"
TMP_DIR="${TMPDIR:-/tmp}/deg-provider-template-verify"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

export DEG_PROVIDER_REGISTRY="$ROOT/registry.yaml"

verify_pin() {
  local id="$1"
  local pin="$2"
  local ref="$id"
  local dir="$ROOT/$id/$pin"

  if [[ "$pin" != "latest" ]]; then
    ref="$id@$pin"
  fi

  local bill
  bill="$(find "$dir" -maxdepth 1 -type f -name 'bill.*' | sort | head -n 1)"
  if [[ -z "$bill" ]]; then
    echo "missing bill.* for $id/$pin" >&2
    return 1
  fi

  local rules="$TMP_DIR/${id}-${pin}-rules.yaml"
  local expected="$dir/expected.beancount"
  local out="$TMP_DIR/${id}-${pin}.beancount"

  "$DEG_BIN" config init "$ref" -o "$rules" --force >/dev/null
  "$DEG_BIN" import "$ref" "$bill" --rules "$rules" -o "$out" >/dev/null
  diff -u "$expected" "$out" >/dev/null
  echo "ok $ref"
}

for latest in "$ROOT"/*/latest/template.yaml; do
  id="$(basename "$(dirname "$(dirname "$latest")")")"
  verify_pin "$id" latest
  for dated in "$ROOT/$id"/*/template.yaml; do
    pin="$(basename "$(dirname "$dated")")"
    [[ "$pin" == "latest" ]] && continue
    verify_pin "$id" "$pin"
  done
done
