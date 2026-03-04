import Link from "next/link";
import type { Tool } from "@/data/tools";

const statusLabel: Record<Tool["status"], string> = {
  active: "tool",
  placeholder: "placeholder",
};

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold tracking-tight text-zinc-950">
            {tool.name}
          </div>
          <div className="mt-2 text-sm leading-6 text-zinc-600">
            {tool.status === "placeholder" ? "Coming soon." : tool.description}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {statusLabel[tool.status]}
        </span>
      </div>
    </Link>
  );
}

