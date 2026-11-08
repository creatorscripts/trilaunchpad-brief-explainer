# TriLaunchpad brief explainer

Weekly race-brief explainer reels for [triathlon.mx](https://triathlon.mx), rendered with [Remotion](https://www.remotion.dev).

- Make ("Brief Explainer · Weekly build") picks the race, writes the script, makes the ElevenLabs voice and sends a `repository_dispatch` (`render-brief`).
- `.github/workflows/render.yml` renders the MP4, publishes it under `docs/renders/` (GitHub Pages) and calls back the Make webhook.
- Payload: `{ run_key, props, vo_url, card_url, callback }` — `props` follows `sample-props.json` (`scenes` + `cuts` from the voice timestamps).

Local preview: `npm ci && cp sample-props.json props.json && npx remotion studio src/index.ts`.
