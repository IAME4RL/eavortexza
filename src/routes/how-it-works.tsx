import { createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/SiteNav";
import { HowItWorks, CtaBand } from "@/components/Sections";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — EA VORTEX" },
      { name: "description", content: "Upload a chart, let AI analyse it, and review your results in your private dashboard." },
      { property: "og:title", content: "How It Works — EA VORTEX" },
      { property: "og:description", content: "Upload, analyse, review: the EA VORTEX AI chart scanning workflow." },
    ],
  }),
  component: () => (
    <PublicLayout>
      <div className="py-6"><HowItWorks /></div>
      <CtaBand />
    </PublicLayout>
  ),
});
