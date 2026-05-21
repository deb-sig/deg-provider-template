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

## Install

```bash
deg template update
deg template add alipay
deg import --template alipay bill.csv
```

Manual import is also supported:

```bash
deg template add --path ./templates/alipay/latest.yaml
```
