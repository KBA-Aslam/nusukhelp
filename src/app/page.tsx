export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm tracking-[0.2em] text-brass uppercase">
        nusukhelp.com
      </p>
      <h1 className="mt-4 text-4xl text-pine">Phase 1 — foundation</h1>
      <p className="mt-4 text-slate">
        Next.js 15 on Cloudflare Workers via OpenNext. D1, KV, and R2 bindings
        are configured; the public site is built from Phase 3 onwards.
      </p>
      <hr className="my-8 border-mist" />
      <p className="text-xs text-slate">
        Nusuk Help is an independent private company. It is not affiliated with,
        authorised by, or partnered with the Nusuk platform or the Ministry of
        Hajj and Umrah.
      </p>
    </main>
  );
}
