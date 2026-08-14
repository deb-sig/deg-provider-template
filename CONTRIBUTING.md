# Contributing provider templates

DEG uses runtime templates as the default way to add a bill parser. Templates
keep bill-specific parsing and account-mapping rules out of the Go codebase and
let format updates ship independently.

## Decide whether a template fits

Use a template when each input row can be converted independently and the
required result can be expressed with the supported fields, conditions,
expressions, `from`/`to`, metadata, tags, variables, or explicit postings.

Open a proposal in
[`deb-sig/double-entry-generator`](https://github.com/deb-sig/double-entry-generator)
for a custom Go provider only when at least one of these is required:

- state carried across rows, such as reconstructing a transaction from several
  records;
- joining multiple input files;
- reading a container or binary format that DEG does not support;
- output semantics that cannot be expressed with the current actions.

A new column name, delimiter, encoding, header offset, date layout, condition,
account mapping, fee posting, or metadata field is not by itself a reason for a
Go provider.

## Add a template

1. Choose a stable lowercase provider id. Existing ids use letters, digits,
   hyphens, or underscores.
2. Copy a nearby provider with the same input format to `<id>/latest/`.
3. Replace all four fixtures in that directory:
   `template.yaml`, `rules.yaml`, exactly one `bill.*`, and
   `expected.beancount`.
4. Add a dated copy at `<id>/YYYY-MM-DD/`. The date marks the bill-format
   boundary represented by that immutable pin.
5. Add one entry to `registry.yaml`. Its `latest`, `versions`, `path`, and
   `starterRules` values must match the directories and files above.
6. Run the repository verifier.

Do not include real account numbers, names, addresses, transaction ids, or other
personal data in fixtures. Use small synthetic examples that cover the format's
important branches.

## Minimal profile

```yaml
schema: https://deg.dev/template-profile/v2
id: example-bank
name: Example Bank CSV
template:
  fileFormat: csv
  encoding: utf-8
  delimiter: ','
  sourceHeaders:
    - Date
    - Description
    - Amount
  defaultCurrency: CNY
templateRules:
  - id: Base transaction
    actions:
      date: <Date>
      narration: <Description>
      amount: <Amount>.number
      currency: CNY
personalRules:
  - id: Default expense
    when: <Amount>.number < 0
    actions:
      from: Assets:FIXME
      to: Expenses:FIXME
```

`rules.yaml` contains the user-editable `personalRules` starter for the same
profile. Keep institution-specific format logic in `templateRules`; keep sample
account choices in `personalRules`.

See [`docs/template-profile-v2.md`](docs/template-profile-v2.md) for every
supported field and action.

## Registry entry

```yaml
  - id: example-bank
    name: Example Bank CSV
    category: bank
    tags:
      - bank
      - csv
    latest: "2026-08-14"
    versions:
      - "2026-08-14"
    path: example-bank/latest/template.yaml
    starterRules: example-bank/latest/rules.yaml
    description: Example Bank CSV template.
```

The registry is version `1`. Provider ids must be unique. `latest` must also be
listed in `versions`, and every listed pin must have a matching directory.

## Verify locally

Build DEG from the companion repository or install the current main branch:

```bash
go install github.com/deb-sig/double-entry-generator/v2@main
DEG_BIN="$(go env GOPATH)/bin/double-entry-generator" scripts/verify.sh
```

The verifier checks registry structure and fixture layout before exercising the
real CLI. It runs `template list`, creates starter rules, imports the fixture for
`latest` and every dated pin, and compares the output byte-for-byte with
`expected.beancount`.

Before opening a pull request, also run:

```bash
bash -n scripts/verify.sh
git diff --check
```

## Update an existing format

If a bill format changes, preserve every existing dated pin. Add a new dated
directory, update `latest/` to the new files, append the new date to `versions`,
and set `latest` to that date. A correction that changes expected output for an
existing pin needs an explanation in the pull request because pins are intended
to be reproducible.

See [`docs/compatibility.md`](docs/compatibility.md) for the compatibility
contract.
