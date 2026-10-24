# EA VORTEX — Resume & Complete

## Market Signals (rule-based scanner)
- [x] Real market-data layer (Yahoo Finance chart API, GOLD via GC=F futures), 15-strategy engine, HTF confirmation, expiry, dedupe, signals table + RLS
- [x] Market Signals dashboard page with signal card, history, and walk-forward backtesting (verified in browser: NO TRADE honesty + backtest metrics)
- [ ] Wire scanner signals into Auto Trade bot queue (Auto-Trade AI Signals toggle) — deferred by user until credits allow

## Get the app
- [x] ACTIVATE BOT links to /get-app with iOS Add-to-Home-Screen steps and Android APK download; home-screen icons (192/512/maskable/180) in manifest + head.
- [ ] Rebuild the APK with the published site URL (current build loads the preview address) and sign a release build with a proper release keystore before public distribution.

## MT5 Bridge download
- [x] MT5 bridge EA + dashboard controls (start/stop, live mode, emergency close, strategies)
- [ ] Verify the download and bridge protocol tests; MT5 compilation and demo execution require a Windows MT5 terminal.

- [ ] Recreate database schema on new backend (profiles, roles, scans, accounts, watchlist, notifications, mentor assignments, settings + RLS + helpers)
- [ ] Create private `charts` storage bucket + access policies
- [ ] Animated Vortex background (red particles, ambient glow, candlesticks, price lines, grid) site-wide
- [ ] Complete stub pages: Scan History, Notifications, Settings, EA Management, Analytics, Market/Watchlist, Mentor Portal, Admin
- [ ] Verify build + main journeys
