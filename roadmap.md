# EA VORTEX — Resume & Complete

## Market Signals (rule-based scanner)
- [x] Real market-data layer (Yahoo Finance chart API, GOLD via GC=F futures), 15-strategy engine, HTF confirmation, expiry, dedupe, signals table + RLS
- [x] Market Signals dashboard page with signal card, history, and walk-forward backtesting (verified in browser: NO TRADE honesty + backtest metrics)
- [x] AI Chart Scanner results page links to Market Signals with the scanned instrument/timeframe and auto-generates a signal on arrival (?instrument=…&timeframe=…&auto=true)
- [ ] Wire scanner signals into Auto Trade bot queue (Auto-Trade AI Signals toggle) — deferred by user until credits allow

## Get the app
- [x] ACTIVATE BOT links to /get-app with iOS Add-to-Home-Screen steps and Android APK download; home-screen icons (192/512/maskable/180) in manifest + head.
- [x] APK v1.0.1 rebuilt against the published URL (https://eavortexza.lovable.app) — opens the live site directly, no Lovable preview redirect. Project recreated at /root/eavortex-android.
- [ ] Sign a release build with a proper release keystore before public distribution (current build is debug-signed).

## MT5 Bridge download
- [x] MT5 bridge EA + dashboard controls (start/stop, live mode, emergency close, strategies)
- [ ] Verify the download and bridge protocol tests; MT5 compilation and demo execution require a Windows MT5 terminal.

## Product tiers (planned with user)
- [ ] In-app push notifications + 1-tap quick-copy trade cards for signal-only clients (any broker, phone only)
- [ ] MetaAPI cloud gateway tier: paying clients connect any-broker MT5 accounts for true Auto Trade without a PC
- [ ] Verify build + main journeys
