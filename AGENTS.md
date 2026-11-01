<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Ship the MT5 connector as same-origin MQL5 source at `public/EA_VORTEX_Bridge.mq5`, matching the dashboard download and existing pipe-delimited bridge protocol.
- Scope the public homepage visual theme under `.vortex-home` so reference-inspired styling cannot alter authenticated trading portals.
- The terminal connector journals execution intent before broker submission and retries reports, never uncertain orders, to avoid duplicate trades after interruptions.
- Mobile web installation uses manifest-only metadata, without an app-shell service worker; Android APK downloads require a genuine compiled, signed artifact, not a renamed web file.
- The Android APK is a minimal native WebView wrapper (no Capacitor) built from `/root/eavortex-android` (Gradle + AGP 8.5.2, SDK 34, package `co.eavortex.app`); the shipped artifact lives at `public/downloads/EA-VORTEX.apk` and its target URL is a single constant in `MainActivity.java` — rebuild with the published URL after launch.
