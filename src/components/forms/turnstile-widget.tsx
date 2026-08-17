'use client';

import { useEffect, useId, useRef } from 'react';

import {
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_SITE_KEY,
  isTurnstileConfigured,
} from '@/lib/turnstile';

/**
 * The Cloudflare Turnstile widget (§2, §14.1).
 *
 * Rendered **explicitly** rather than by Cloudflare's auto-scan of the DOM.
 * Auto-render looks simpler and is wrong here: it binds to whatever
 * `.cf-turnstile` elements exist when the script happens to load, which in a
 * React tree means a widget that silently fails to appear when a form mounts
 * after the script, and duplicate widgets when one mounts twice. Explicit
 * rendering ties the widget's life to this component's.
 *
 * ## The token goes to the parent, not into a hidden input
 *
 * Turnstile's own convention is to write its token into a hidden field named
 * `cf-turnstile-response`, which is right for a form that posts natively. These
 * forms post JSON through React Hook Form, so the token is lifted through
 * `onToken` and put in the request body under the same field name — the API
 * reads one key whichever way the form is built.
 *
 * ## Expiry is handled, because it is the common bug
 *
 * A Turnstile token is valid for a few minutes. Someone who opens the review
 * form, writes carefully for ten minutes and submits would otherwise get a
 * flat rejection from a server-side check they cannot see. `expired-callback`
 * clears the token and `timeout-callback` refreshes the widget, so the form
 * knows it is not submittable rather than discovering it at the server.
 */

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      'timeout-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** Set as the script's `onload`; see `loadTurnstileScript`. */
    onTurnstileReady?: () => void;
  }
}

/**
 * Loads the API script once per document, and resolves when `window.turnstile`
 * is actually usable — not merely when the tag has been appended. Concurrent
 * callers share the one promise, so two forms on a page load one script.
 */
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later mount try again rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error('Turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function TurnstileWidget({
  locale,
  onToken,
  onError,
}: {
  /** Renders the challenge's own copy in the reader's language. */
  locale: string;
  onToken: (token: string | null) => void;
  onError: () => void;
}) {
  const containerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // Held in refs so the effect below can stay dependency-free: re-running it
  // because a parent re-rendered would tear down and rebuild the challenge,
  // which is visible and resets any solved state.
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isTurnstileConfigured()) return;

    let widgetId: string | null = null;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          language: locale,
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => {
            onTokenRef.current(null);
            onErrorRef.current();
          },
          'expired-callback': () => onTokenRef.current(null),
          'timeout-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current();
      });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [locale]);

  if (!isTurnstileConfigured()) {
    /*
     * No site key in this build. The widget cannot render, and the server
     * rejects every submission because verification fails closed — so the form
     * says so rather than letting someone write a review that cannot be sent.
     * This state should never reach production; it is what a misconfigured
     * build looks like, and it is deliberately loud.
     */
    return (
      <p
        role="status"
        className="rounded-[2px] border border-hairline bg-mist px-4 py-3 text-sm text-slate"
      >
        Verification is not configured for this build, so the form cannot be
        submitted. NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset.
      </p>
    );
  }

  return <div id={containerId} ref={containerRef} className="min-h-[65px]" />;
}
