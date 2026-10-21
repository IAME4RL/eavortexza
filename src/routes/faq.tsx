import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/SiteNav";
import { FaqList, SectionHead, CtaBand } from "@/components/Sections";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — EA VORTEX" },
      { name: "description", content: "Answers about the free AI Chart Scanner, GOLD support, EA connections and privacy." },
      { property: "og:title", content: "FAQ — EA VORTEX" },
      { property: "og:description", content: "Frequently asked questions about EA VORTEX." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-10"><FaqList /></div>
      </section>
      <CtaBand />
    </PublicLayout>
  ),
});
