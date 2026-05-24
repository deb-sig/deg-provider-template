# DEG Provider Template

This repository stores runtime provider templates for `double-entry-generator`.

Each provider is organized by import ref. `provider/latest/` is used by `import provider`; dated pins such as `provider/2026-04-28/` are used by `import provider@2026-04-28`. A pin is a frozen bill format boundary, not a file-extension-specific provider id.

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

`template.yaml` describes how to read the bill file. `rules.yaml` is the starter personal-rule skeleton for that exact pin. `bill.*` and `expected.beancount` are the regression example for the same pin.

## Usage

```bash
deg template list
deg config init wechat --output ./wechat-rules.yaml
deg import wechat bill.xlsx --rules ./wechat-rules.yaml
deg import wechat@2026-04-28 bill.xlsx --rules ./wechat-rules.yaml
```

`wechat` reads the online registry directly. Local paths and HTTP(S) URLs are used only for the current import and are not cached by DEG.
