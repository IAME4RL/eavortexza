import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/dash";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({ component: Page });

function Page() {
  return (
    <>
      <PageHeader title="Notifications" />
      <EmptyState icon={Construction} title="Coming soon">This section is not finished yet.</EmptyState>
    </>
  );
}
