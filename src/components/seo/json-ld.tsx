import type { JsonLdObject } from '@/lib/structured-data';

/**
 * Renders a structured-data document into the page (§17).
 *
 * ## The escaping is not optional
 *
 * `dangerouslySetInnerHTML` writes the JSON verbatim into the document, and the
 * HTML parser ends a `<script>` element at the first `</script...` sequence
 * *regardless of JavaScript string quoting*. A review comment containing
 * `</script>` would therefore close the tag early and the rest of the JSON
 * would land in the page as markup. Escaping `<` to its `<` form is the
 * standard fix — it is legal JSON, it parses identically, and there is then no
 * character sequence that can terminate the element.
 *
 * This matters here specifically because reviewer comments reach
 * `AggregateRating`'s neighbourhood: the rating is aggregate and carries no
 * free text today, but the input is public and moderated by a human, not by a
 * parser.
 *
 * ## CSP
 *
 * This is an inline script, so it needs `script-src 'unsafe-inline'`, which the
 * policy in `next.config.ts` already carries for Next's own inline bootstrap.
 * If that policy ever moves to nonces, this component takes a nonce with it —
 * which would mean rendering it per request, and the public site is static
 * (§17). See the CSP note in `next.config.ts`.
 */
export function JsonLd({ data }: { data: JsonLdObject }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
