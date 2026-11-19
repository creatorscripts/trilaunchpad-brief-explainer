// Cast-list reel: reads the render payload, downloads the voice + one clip per scene into public/,
// writes props.json and exports env vars for the workflow.
// Payload: { run_key, lang, props, vo_url, clip_urls: [..], callback }
import fs from "node:fs";

const raw = process.env.CP && process.env.CP !== "null" && process.env.CP !== "{}" ? process.env.CP : process.env.WD;
if (!raw) throw new Error("No payload: send client_payload or workflow input 'payload'");
let payload = JSON.parse(raw);
if (typeof payload === "string") payload = JSON.parse(payload);
let props = payload.props;
if (typeof props === "string") props = JSON.parse(props);
let clips = payload.clip_urls;
if (typeof clips === "string") clips = JSON.parse(clips);

for (const k of ["run_key", "lang", "vo_url"]) if (!payload[k]) throw new Error(`payload.${k} missing`);
if (!Array.isArray(clips) || clips.length !== props.scenes.length)
  throw new Error(`clips/scenes mismatch: ${clips?.length} clips, ${props.scenes?.length} scenes`);
if (props.cuts.length !== props.scenes.length - 2)
  throw new Error(`cuts mismatch: ${props.cuts.length} cuts for ${props.scenes.length} scenes`);

const lang = String(payload.lang).toLowerCase().replace(/[^a-z]/g, "");
const runKey = `${String(payload.run_key).replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${lang}`;

async function download(url, dest, min = 1000) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = await fetch(url, { redirect: "follow" });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length >= min) { fs.writeFileSync(dest, buf); console.log(`saved ${dest} (${buf.length} B)`); return; }
      console.log(`too small (${buf.length} B), retry ${attempt}`);
    } else console.log(`HTTP ${r.status}, retry ${attempt}`);
    await new Promise((s) => setTimeout(s, 3000 * attempt));
  }
  throw new Error(`Download failed for ${dest}`);
}

fs.mkdirSync("public", { recursive: true });
await download(payload.vo_url, "public/vo.mp3");
for (let i = 0; i < clips.length; i++) await download(clips[i], `public/clip-${i}.mp4`, 50000);

props.vo = "vo.mp3";
props.bed = "bed.wav";
props.lang = lang;
props.scenes = props.scenes.map((s, i) => ({ ...s, clip: `clip-${i}.mp4` }));
fs.writeFileSync("props.json", JSON.stringify(props, null, 2));

const FPS = 30;
const cover = Math.round(props.coverSec * FPS);
const frames = cover + Math.round(props.voSec * FPS);
const cuts = [cover, ...props.cuts.map((c) => cover + Math.round(c * FPS))].join(",");
const env = [`RUN_KEY=${runKey}`, `FRAMES=${frames}`, `CUTS=${cuts}`, `CALLBACK=${payload.callback || ""}`, `FILE=${runKey}.mp4`, `LANG_CODE=${lang}`, `EPISODE=${payload.run_key}`].join("\n");
if (payload.callback) console.log(`::add-mask::${payload.callback}`);
fs.appendFileSync(process.env.GITHUB_ENV, env + "\n");
console.log(env.split("\n").filter((l) => !l.startsWith("CALLBACK=")).join("\n"));
