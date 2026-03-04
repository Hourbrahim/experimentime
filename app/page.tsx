import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/tools";

export default function Home() {
  return (
    <div>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </section>
    </div>
  );
}
