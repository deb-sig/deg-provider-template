# DEG Provider Template

This repository stores runtime provider templates for `double-entry-generator`.

Official templates are YAML only. Template files describe how a bill file is parsed and how provider-level rules normalize rows into DEG transactions. Web display metadata such as category and tags belongs in `registry.yaml`, not in each template.

## Layout

```text
registry.yaml
templates/
  alipay/
    latest.yaml
    2026.05.yaml
  wechat/
    latest.yaml
    2026.05.yaml
```

## Usage

```bash
deg template list
deg config init wechat --output ./wechat-rules.yaml
deg import alipay bill.csv
```

Template refs are resolved by shape:

```bash
deg import wechat bill.csv
deg import ./templates/wechat/latest.yaml bill.csv
deg import https://example.com/wechat.yaml bill.csv
```

`wechat` reads the online registry directly. Local paths and HTTP(S) URLs are
used only for the current import and are not cached by DEG.

`deg config init` writes a local personal-rule skeleton. Users can edit account
names in that file and pass it back with `deg import --rules`.
