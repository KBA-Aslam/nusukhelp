# Message catalogues

`en.json` is written first and is the source of truth for **structure**.
`ar.json` mirrors it key for key.

## Why `ar.json` is full of English

Per **§19, open item 5**, the Arabic translation of the public copy is a client
deliverable that has not landed yet. The spec's placeholder rule is explicit:

> The Arabic message files still get the **real keys** immediately, with English
> strings as their placeholder values — that way the `/ar` routes render, the
> RTL layout is testable throughout the build, and the translation drop is a
> values-only change with no structural surprises.

So `ar.json` carries the finished key tree with English values. `/ar` renders,
`dir="rtl"` is exercised on every screen from Phase 3 onward, and when the
translation arrives it is a values-only diff — no new keys, no layout surprises.

**Do not** defer creating a key in `ar.json` because the Arabic wording is
unknown. Add the key with the English string.

## The one exception

`footer.disclaimer` is genuinely translated. §7 requires the affiliation
disclaimer to be present **in both languages**, because it is the mitigation for
the largest business risk in the project — a site at `nusukhelp.com` reading as
officially affiliated with the Saudi Ministry of Hajj and Umrah's Nusuk
platform. An English-only disclaimer on the Arabic site does not mitigate
anything for an Arabic-speaking reader.

This one string should be reviewed by the client's Saudi legal advisor alongside
open item 1, not silently replaced during the translation drop.

## Rules

- Keys are `camelCase`, grouped by the component or page that consumes them.
- Both files must always have identical key sets. A key present in one and
  absent in the other throws at render time in the locale that is missing it.
- Western Arabic numerals (`1234`) in both locales (§6) — never Eastern Arabic
  numerals. This is why `timeZone` and number formatting go through next-intl's
  formatter with the `en` numbering system rather than raw `toLocaleString`.
