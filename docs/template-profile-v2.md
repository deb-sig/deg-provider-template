# Template profile v2 reference

Every `template.yaml` is a YAML profile with
`schema: https://deg.dev/template-profile/v2`. Unknown YAML keys are ignored by
the current decoder, so contributors should use only the fields documented here
and rely on `scripts/verify.sh` to exercise the profile with current DEG.

## Profile fields

| Field | Type | Purpose |
| --- | --- | --- |
| `schema` | string | Must be `https://deg.dev/template-profile/v2`. |
| `id` | string | Must match the provider directory and registry id. |
| `name` | string | Human-readable template name. |
| `template` | object | Input parsing options described below. |
| `templateRules` | rule list | Institution and file-format behavior. |
| `templateRuleOverrides` | rule list | Overrides applied to template rules. |
| `personalRules` | rule list | User account-mapping defaults and examples. |
| `defaults` | string map | Default named values available to the profile. |

## Input template fields

| Field | Type | Purpose |
| --- | --- | --- |
| `fileFormat` | string | `csv`, `xls`, or `xlsx`. |
| `encoding` | string | Text encoding, for example `utf-8` or `gb18030`. |
| `delimiter` | string | CSV delimiter; use `"\t"` for tab-delimited text. |
| `stripTabs` | boolean | Remove tab characters before parsing values. |
| `skipLeadingRows` | integer | Number of rows before the header or data. |
| `skipInvalidRows` | boolean | Skip rows that cannot be normalized. |
| `dateFormat` | string | Date layout used by legacy column mappings. |
| `amountPrefix` | string | Prefix removed from legacy amount values. |
| `sourceHeaders` | string list | Explicit source column names, in order. |
| `columns` | object | Legacy column mapping; fields are `date`, `time`, `amount`, `amountIn`, `amountOut`, `payee`, `narration`, `type`, and `currency`. |
| `metadata` | string map | Static metadata copied into each transaction. |
| `defaultMinusAccount` | string | Default source account. |
| `defaultPlusAccount` | string | Default destination account. |
| `defaultCurrency` | string | Currency used when no rule overrides it. |

Headers are referenced as `<Header>`. The unmodified source value is also
available as `raw[Header]`.

## Rules

Rules run in order. Later matching rules can override values set by earlier
rules. Each rule supports:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Stable rule identifier. |
| `name` | string | Optional display name. |
| `enabled` | boolean | Disable a rule without deleting it. |
| `when` | expression | Optional condition; an omitted condition always matches. |
| `actions` | object | Values to write when the rule matches. |

Conditions support `==`, `!=`, `>`, `>=`, `<`, `<=`, regular-expression match
`~` and `!~`, and boolean `&&` / `||`. Parentheses control grouping.

Examples:

```yaml
when: <Direction> == expense
when: <Amount>.number >= 10
when: (<Type> ~ refund || <Type> ~ reversal) && <Status> != failed
```

## Expressions

Fields can be combined with literal text and simple arithmetic. Supported value
helpers include:

- `.number` to normalize an amount;
- `.+`, `.-`, and `.!` to force positive, force negative, or invert a sign;
- `.extract("regex")` to extract text;
- `.format("format")` to format a value;
- `.date`, `.time`, and `.timestamp` to extract date/time values.

```yaml
amount: <Gross>.number - <Fee>.number
narration: <Type>-<Description>
```

## Actions

| Field | Type | Purpose |
| --- | --- | --- |
| `date` | expression | Transaction date. |
| `type` | expression | Transaction type or direction. |
| `note` | expression | Note text. |
| `payee` | expression | Payee. |
| `narration` | expression | Narration. |
| `amount` | expression | Shared amount for a normal transfer. |
| `currency` | expression | Shared currency for a normal transfer. |
| `from` / `to` | string or object | Account, or an object with `account`, `amount`, and `currency`. |
| `tag` | expression | One tag. |
| `tags` | string list | Multiple tags. |
| `ignore` | boolean | Suppress the matched transaction. |
| `vars` | string map | Rule-local values referenced as `<var.name>`. |
| `metadata` | string map | Transaction metadata. |
| `postings` | expression list | Explicit postings for complex transactions. |

Prefer `from` and `to` for an ordinary two-posting transaction:

```yaml
actions:
  from:
    account: Assets:Bank
  to:
    account: Expenses:Food
  amount: <Amount>.number
  currency: CNY
```

Use `postings` only when the transfer needs more than two postings or explicit
cost/price syntax:

```yaml
actions:
  vars:
    cash: Assets:Broker:Cash
  postings:
    - <var.cash> -<Total>.format("%.2f") CNY
    - Assets:Broker:Position <Quantity>.number STOCK {<Price>.number CNY}
```

The executable behavior is defined by DEG. When this reference and current DEG
disagree, open an issue and treat the verifier against DEG `main` as the
compatibility gate.
