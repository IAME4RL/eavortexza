import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dash";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({ component: Page });

function Page() {
  return (
    <>
      <PageHeader title="Settings" />
      <EmptyState icon={Construction} title="Coming soon">This section is not finished yet.</EmptyState>
    </>
  );
}
