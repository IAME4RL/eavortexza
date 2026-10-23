import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, ArrowRight, Download, PlusSquare, Share, Smartphone } from "lucide-react";
import { PublicLayout } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/get-app")({
  head: () => ({
    meta: [
      { title: "Get the App — EA VORTEX" },
      { name: "description", content: "Add EA VORTEX to your iPhone home screen or download the Android app." },
      { property: "og:title", content: "Get the App — EA VORTEX" },
      { property: "og:description", content: "EA VORTEX installation options for iOS and Android." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetApp,
});

function GetApp() {
  return (
    <PublicLayout>
      <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <header className="text-center">
          <LogoMark className="mx-auto h-16 w-16" />
          <p className="eyebrow mt-6">EA VORTEX · Power Your Trading</p>
          <h1 className="mt-4 text-4xl font-bold uppercase sm:text-5xl">Get the <span className="text-primary">app</span></h1>
          <p className="mt-4 text-muted-foreground">iOS & Android</p>
        </header>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-6 sm:p-8" aria-labelledby="ios-title">
            <Apple className="h-8 w-8 text-primary" aria-hidden />
            <h2 id="ios-title" className="mt-5 text-2xl font-bold">iPhone & iPad</h2>
            <p className="mt-2 text-sm text-muted-foreground">Add to Home Screen</p>
            <ol className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3"><span className="font-mono text-primary">01</span><span>Open the published EA VORTEX website in Safari.</span></li>
              <li className="flex gap-3"><span className="font-mono text-primary">02</span><span>Tap <Share className="inline h-4 w-4" aria-hidden /> Share, then <PlusSquare className="inline h-4 w-4" aria-hidden /> Add to Home Screen.</span></li>
              <li className="flex gap-3"><span className="font-mono text-primary">03</span><span>If shown, enable Open as Web App. Tap Add.</span></li>
            </ol>
            <Button variant="hero" size="xl" className="mt-8 w-full" asChild><Link to="/dashboard">Open EA VORTEX <ArrowRight /></Link></Button>
            <p className="mt-4 text-xs text-muted-foreground">Home-screen web app · Internet connection required</p>
          </section>

          <section className="rounded-lg border border-border bg-card p-6 sm:p-8" aria-labelledby="android-title">
            <Smartphone className="h-8 w-8 text-primary" aria-hidden />
            <h2 id="android-title" className="mt-5 text-2xl font-bold">Android</h2>
            <p className="mt-2 text-sm text-muted-foreground">APK download · Version 1.0.0 (test build)</p>
            <ol className="mt-6 space-y-4 text-sm">
              <li className="flex gap-3"><span className="font-mono text-primary">01</span><span>Download the APK below on your Android phone (Android 7.0 or newer).</span></li>
              <li className="flex gap-3"><span className="font-mono text-primary">02</span><span>Open the file and allow installation from this source when Android asks.</span></li>
              <li className="flex gap-3"><span className="font-mono text-primary">03</span><span>Open EA VORTEX from your app drawer and sign in.</span></li>
            </ol>
            <Button variant="hero" size="xl" className="mt-8 w-full" asChild><a href="/downloads/EA-VORTEX.apk" download="EA-VORTEX.apk"><Download /> Download APK</a></Button>
            <p className="mt-4 text-xs text-muted-foreground">Test build signed with a development certificate · Loads the live EA VORTEX web app · Internet connection required</p>
            <Button variant="link" className="mt-4 px-0" asChild><Link to="/dashboard">Use EA VORTEX in your browser <ArrowRight /></Link></Button>
          </section>
        </div>
      </main>
    </PublicLayout>
  );
}