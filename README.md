# DEG Provider Template

This repository stores runtime provider templates for
[`double-entry-generator`](https://github.com/deb-sig/double-entry-generator)
(DEG).

New bill formats belong here by default. A template can parse CSV, XLS, and XLSX
files, normalize columns, evaluate row-level conditions and expressions, and
produce ordinary or explicit postings. Propose a custom Go provider in DEG only
when the format requires cross-row state, joins across multiple input files, an
unsupported container format, or output semantics that template actions cannot
express.

Each provider is organized by import ref. `provider/latest/` is used by
`import provider`; dated pins such as `provider/2026-04-28/` are used by
`import provider@2026-04-28`. A pin is a frozen bill format boundary, not a
file-extension-specific provider id.

## Layout

```text
registry.yaml
wechat/
  latest/
    template.yaml
    rules.yaml
    bill.xlsx
    expected.beancount
  2026-04-28/
    template.yaml
    rules.yaml
    bill.xlsx
    expected.beancount
alipay/
  latest/
    template.yaml
    rules.yaml
    bill.csv
    expected.beancount
  2026-05-23/
    template.yaml
    rules.yaml
    bill.csv
    expected.beancount
```

`template.yaml` describes how to read the bill file. `rules.yaml` is the starter
personal-rule skeleton for that exact pin. `bill.*` and `expected.beancount` are
the regression example for the same pin.

## Usage

```bash
double-entry-generator template list
double-entry-generator config init wechat --output ./wechat-rules.yaml
double-entry-generator import wechat bill.xlsx --rules ./wechat-rules.yaml
double-entry-generator import wechat@2026-04-28 bill.xlsx --rules ./wechat-rules.yaml
```

`wechat` reads the online registry directly. Local paths and HTTP(S) URLs are used only for the current import and are not cached by DEG.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). It contains a copy-and-edit
workflow, a minimal template, registry requirements, and the local verification
command. The complete profile reference is
[`docs/template-profile-v2.md`](docs/template-profile-v2.md); compatibility and
pinning rules are in [`docs/compatibility.md`](docs/compatibility.md).

Every contribution must pass:

```bash
DEG_BIN=double-entry-generator scripts/verify.sh
```

The verifier checks the registry and every template fixture, then exercises
`template list`, `config init`, and `import` for both `latest` and every dated
pin. CI installs DEG from its current `main` branch and runs the same command.
