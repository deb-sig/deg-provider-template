#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEG_BIN="${DEG_BIN:-double-entry-generator}"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/deg-provider-template-verify.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

export DEG_PROVIDER_REGISTRY="$ROOT/registry.yaml"

fail() {
  echo "error: $*" >&2
  exit 1
}

strip_yaml_string() {
  sed -e 's/^"//' -e 's/"$//'
}

registry_block() {
  local wanted_id="$1"
  awk -v wanted_id="$wanted_id" '
    $0 == "  - id: " wanted_id { found = 1 }
    found && $0 ~ /^  - id: / && $0 != "  - id: " wanted_id { exit }
    found { print }
  ' "$ROOT/registry.yaml"
}

registry_field() {
  local block="$1"
  local field="$2"
  printf '%s\n' "$block" | awk -v field="$field" '
    index($0, "    " field ": ") == 1 {
      sub("^    " field ": ", "")
      print
      exit
    }
  ' | strip_yaml_string
}

registry_versions() {
  local block="$1"
  printf '%s\n' "$block" | awk '
    /^    versions:$/ { in_versions = 1; next }
    in_versions && /^      - / {
      sub(/^      - /, "")
      gsub(/^"|"$/, "")
      print
      next
    }
    in_versions { exit }
  '
}

[[ "$(sed -n '1s/^version: //p' "$ROOT/registry.yaml")" == "1" ]] ||
  fail "registry.yaml must declare version: 1"

registry_ids="$(awk '/^  - id: / { print $3 }' "$ROOT/registry.yaml")"
[[ -n "$registry_ids" ]] || fail "registry.yaml contains no templates"

duplicate_ids="$(printf '%s\n' $registry_ids | sort | uniq -d)"
[[ -z "$duplicate_ids" ]] || fail "duplicate registry id(s): $duplicate_ids"

directory_ids="$({
  find "$ROOT" -mindepth 3 -maxdepth 3 -path '*/latest/template.yaml' -print |
    sed -e "s#^$ROOT/##" -e 's#/latest/template.yaml$##' |
    sort
})"
[[ "$(printf '%s\n' $registry_ids | sort)" == "$directory_ids" ]] ||
  fail "registry ids do not match provider directories"

for id in $registry_ids; do
  block="$(registry_block "$id")"
  latest="$(registry_field "$block" latest)"
  path="$(registry_field "$block" path)"
  starter_rules="$(registry_field "$block" starterRules)"
  versions="$(registry_versions "$block")"

  [[ -n "$latest" ]] || fail "$id has no latest version"
  [[ -n "$versions" ]] || fail "$id has no versions"
  [[ "$path" == "$id/latest/template.yaml" ]] || fail "$id has invalid path: $path"
  [[ "$starter_rules" == "$id/latest/rules.yaml" ]] || fail "$id has invalid starterRules: $starter_rules"
  printf '%s\n' $versions | grep -Fxq "$latest" || fail "$id latest is not listed in versions"

  directory_versions="$({
    find "$ROOT/$id" -mindepth 2 -maxdepth 2 -name template.yaml -print |
      sed -e "s#^$ROOT/$id/##" -e 's#/template.yaml$##' |
      grep -v '^latest$' |
      sort
  })"
  [[ "$(printf '%s\n' $versions | sort)" == "$directory_versions" ]] ||
    fail "$id registry versions do not match dated directories"

  for pin in latest $versions; do
    dir="$ROOT/$id/$pin"
    template="$dir/template.yaml"
    [[ -f "$template" ]] || fail "missing template.yaml for $id/$pin"
    [[ -f "$dir/rules.yaml" ]] || fail "missing rules.yaml for $id/$pin"
    [[ -f "$dir/expected.beancount" ]] || fail "missing expected.beancount for $id/$pin"
    bill_count="$(find "$dir" -maxdepth 1 -type f -name 'bill.*' -print | wc -l | tr -d ' ')"
    [[ "$bill_count" -eq 1 ]] || fail "$id/$pin must contain exactly one bill.* fixture"
    [[ "$(sed -n '1s/^schema: //p' "$template")" == "https://deg.dev/template-profile/v2" ]] ||
      fail "$id/$pin does not use template-profile/v2"
    [[ "$(sed -n '2s/^id: //p' "$template")" == "$id" ]] ||
      fail "$id/$pin template id does not match its directory"
  done
done

"$DEG_BIN" template list >/dev/null

verify_pin() {
  local id="$1"
  local pin="$2"
  local ref="$id"
  local dir="$ROOT/$id/$pin"

  if [[ "$pin" != "latest" ]]; then
    ref="$id@$pin"
  fi

  local bill
  bill="$(find "$dir" -maxdepth 1 -type f -name 'bill.*' -print)"

  local rules="$TMP_DIR/${id}-${pin}-rules.yaml"
  local expected="$dir/expected.beancount"
  local out="$TMP_DIR/${id}-${pin}.beancount"

  "$DEG_BIN" config init "$ref" -o "$rules" --force >/dev/null
  "$DEG_BIN" import "$ref" "$bill" --rules "$rules" -o "$out" >/dev/null
  diff -u "$expected" "$out" >/dev/null
  echo "ok $ref"
}

for id in $registry_ids; do
  verify_pin "$id" latest
  block="$(registry_block "$id")"
  while IFS= read -r pin; do
    verify_pin "$id" "$pin"
  done < <(registry_versions "$block")
done
