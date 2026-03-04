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
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          Back to home
        </Link>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              {tool.name}
            </h1>
            <span
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",
                getStatusStyles(tool.status),
              ].join(" ")}
            >
              {tool.status}
            </span>
          </div>

          <p className="mt-4 text-sm leading-7 text-zinc-600 sm:text-base">
            {tool.status === "placeholder" ? "Coming soon." : tool.description}
          </p>

          {tool.status === "active" && tool.embedSrc ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={tool.embedSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
              >
                Open tool
              </a>
              <span className="inline-flex items-center text-sm text-zinc-500">
                Opens the embedded version in a new tab.
              </span>
            </div>
          ) : null}
        </div>

        {tool.status === "active" && tool.embedSrc ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <iframe
              title={tool.name}
              src={tool.embedSrc}
              className="h-[72vh] w-full bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

