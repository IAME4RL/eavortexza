import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/dash";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/scan/$id")({ component: ScanResult });

function ScanResult() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["scans", id], queryFn: async () => (await supabase.from("scans").select("*").eq("id", id).single()).data });
  const a = (q.data?.analysis ?? {}) as Record<string, unknown>;
  return (
    <>
      <PageHeader eyebrow="Hypothetical analysis · not financial advice" title={`${q.data?.instrument ?? ""} ${q.data?.timeframe ?? ""}`}
        actions={<Button variant="hero" asChild><Link to="/dashboard/scanner">Scan Another Chart</Link></Button>} />
      {q.data?.error && <p className="panel p-4 text-primary">{q.data.error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(a).map(([k, v]) => (
          <div key={k} className="panel p-5">
            <h3 className="font-mono text-xs uppercase text-primary">{k.replace(/_/g, " ")}</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
