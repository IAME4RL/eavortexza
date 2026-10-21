import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/SiteNav";
import { FeatureGrid, SectionHead, CtaBand } from "@/components/Sections";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — EA VORTEX" },
      { name: "description", content: "AI Chart Scanner, EA management, client and mentor portals, analytics and market analysis." },
      { property: "og:title", content: "Features — EA VORTEX" },
      { property: "og:description", content: "Everything in the EA VORTEX trading technology platform." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHead eyebrow="Features" title={<>One platform. <span className="text-primary">Every edge.</span></>}
          sub="EA VORTEX combines AI chart analysis, Expert Advisor management and role-based portals for clients, mentors and administrators." />
        <div className="mt-12"><FeatureGrid /></div>
      </section>
      <CtaBand />
    </PublicLayout>
  ),
});
