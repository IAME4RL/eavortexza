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
- The terminal connector journals execution intent before broker submission and retries reports, never uncertain orders, to avoid duplicate trades after interruptions.
