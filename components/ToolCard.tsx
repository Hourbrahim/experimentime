import Link from "next/link";
import type { Tool } from "@/data/tools";

const statusLabel: Record<Tool["status"], string> = {
  active: "tool",
  placeholder: "placeholder",
};

export function ToolCard({ tool }: { tool: Tool }) {
  const href = tool.embedSrc ?? `/tools/${tool.slug}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4 text-xs transition duration-200 ease-out hover:border-[var(--foreground)]/40 hover:bg-[var(--background)] focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium tracking-[0.18em] text-[var(--foreground)] opacity-80 group-hover:opacity-100">
            {tool.name}
          </div>
          <div className="text-[11px] leading-5 text-[var(--text-muted)] group-hover:text-[var(--foreground)]">
            {tool.status === "placeholder" ? "coming soon." : tool.description}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--background)] opacity-80 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {statusLabel[tool.status]}
        </span>
      </div>
    </Link>
  );
}

