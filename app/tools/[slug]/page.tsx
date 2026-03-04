import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tools } from "@/data/tools";

function getStatusStyles(status: "active" | "placeholder") {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const tool = tools.find((t) => t.slug === params.slug);
  if (!tool) return { title: "Not found — experimentime" };
  return {
    title: `${tool.name} — experimentime`,
    description: tool.status === "placeholder" ? "Coming soon." : tool.description,
  };
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = tools.find((t) => t.slug === params.slug);
  if (!tool) notFound();

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center text-[11px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900"
      >
        ← back
      </Link>

      <section className="mt-8 rounded-xl border border-zinc-200/80 bg-white/60 p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              tool
            </p>
            <h1 className="mt-2 text-xl font-medium tracking-tight text-zinc-900 sm:text-2xl">
              {tool.name}
            </h1>
          </div>
          <span
            className={[
              "rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
              getStatusStyles(tool.status),
            ].join(" ")}
          >
            {tool.status}
          </span>
        </div>

        <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-zinc-500">
          {tool.status === "placeholder" ? "Coming soon." : tool.description}
        </p>

        {tool.status === "active" && tool.embedSrc ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={tool.embedSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-800"
            >
              open in new tab
            </a>
            <span className="inline-flex items-center text-[11px] text-zinc-500">
              embedded preview below
            </span>
          </div>
        ) : null}
      </section>

      {tool.status === "active" && tool.embedSrc ? (
        <section className="mt-8 overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          <iframe
            title={tool.name}
            src={tool.embedSrc}
            className="h-[72vh] w-full bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
          />
        </section>
      ) : null}
    </div>
  );
}

