import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-10">
      <div className="max-w-md rounded-xl border border-zinc-200/80 bg-white/70 p-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          404
        </div>
        <h1 className="mt-3 text-xl font-medium tracking-tight text-zinc-900">
          Page not found
        </h1>
        <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-800"
        >
          back to home
        </Link>
      </div>
    </div>
  );
}

