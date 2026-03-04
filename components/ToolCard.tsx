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
      className="group block overflow-hidden rounded-xl border border-zinc-200/70 bg-white/60 p-4 text-xs transition duration-200 ease-out hover:border-zinc-900/40 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium uppercase tracking-[0.18em] text-zinc-700 group-hover:text-zinc-900">
            {tool.name}
          </div>
          <div className="text-[11px] leading-5 text-zinc-500 group-hover:text-zinc-700">
            {tool.status === "placeholder" ? "Coming soon." : tool.description}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-zinc-200/80 bg-zinc-50 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          {statusLabel[tool.status]}
        </span>
      </div>
    </Link>
  );
}

