import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/data/tools";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
        <header className="mb-10 sm:mb-14">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            experimentime
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600 sm:text-lg">
            Creative tools
          </p>
        </header>

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {tools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </section>
      </main>
    </div>
  );
}
