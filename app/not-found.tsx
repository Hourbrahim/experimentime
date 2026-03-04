import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-10">
          <div className="text-sm font-medium text-zinc-500">404</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Page not found
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600 sm:text-base">
            The page you’re looking for doesn’t exist.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

