# Compatibility and versioning

This repository tests templates against the current `main` branch of
[`deb-sig/double-entry-generator`](https://github.com/deb-sig/double-entry-generator).
Passing CI means every registry entry, `latest` ref, and dated pin can be loaded
and its synthetic fixture produces the checked-in expected output with that DEG
revision.

## Profile schema

New and updated profiles use `https://deg.dev/template-profile/v2`. A future
incompatible profile shape must use a new schema version; it must not silently
change the meaning of v2 fields.

## Provider refs

- `<id>` resolves through `<id>/latest/` and may move when the institution
  changes its export format.
- `<id>@YYYY-MM-DD` resolves through that dated directory and is intended to be
  reproducible.
- Every date in `versions` must exist as a directory, and `latest` must be one of
  those versions.

When a format changes, add a dated pin and update `latest`; do not delete or
rewrite older pins. Small corrections to a frozen pin are acceptable only when
the old fixture was demonstrably wrong and the pull request documents the
behavior change.

## DEG releases

The CI compatibility target is DEG `main`, so a merged template change is ready
for the next DEG release. Users of an older DEG release may need to pin an older
template ref if a profile begins using a newly added engine feature. Template
pull requests that require such a feature should name the DEG pull request or
minimum release in their description.

There is currently no promise that a newly updated `latest` ref works with every
historical DEG release. Dated pins preserve the bill-format input and expected
output contract, while CI prevents current DEG development from breaking the
checked-in catalog unnoticed.
