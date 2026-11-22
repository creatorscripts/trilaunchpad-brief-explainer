// Story reel (presenter choreography): downloads B-roll, per-scene voice, the listening loop and any
// talking clips into public/, measures each line's spoken length, writes props.json + GITHUB_ENV.
// Payload: { run_key, title, titleSec?, side?, loop_url, callback?,
//            scenes: [{ image_url, audio_url, line, state: full|circle|split|none, talk_url? }] }
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const raw = process.env.CP && process.env.CP !== "null" && process.env.CP !== "{}" ? process.env.CP : process.env.WD;
if (!raw) throw new Error("No payload");
let p = JSON.parse(raw);
if (typeof p === "string") p = JSON.parse(p);
for (const k of ["run_key", "title", "loop_url", "scenes"]) if (!p[k]) throw new Error(`payload.${k} missing`);
const STATES = ["full", "circle", "split", "none"];
p.scenes.forEach((s, i) => {
  if (!STATES.includes(s.state)) throw new Error(`scene ${i}: bad state ${s.state}`);
  for (const k of ["image_url", "audio_url"]) if (!s[k]) throw new Error(`scene ${i}: ${k} missing`);
});

async function download(url, dest, min = 1000) {
  for (let a = 1; a <= 3; a++) {
    const r = await fetch(url, { redirect: "follow" });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length >= min) { fs.writeFileSync(dest, buf); console.log(`saved ${dest} (${buf.length} B)`); return; }
      console.log(`too small (${buf.length} B), retry ${a}`);
    } else console.log(`HTTP ${r.status}, retry ${a}`);
    await new Promise((s) => setTimeout(s, 3000 * a));
  }
  throw new Error(`Download failed for ${dest}`);
}

// spoken length = duration after trimming trailing silence
const speechSec = (file) => {
  const tmp = `${file}.trim.wav`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-af",
    "areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse", tmp]);
  const d = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmp]).toString());
  fs.unlinkSync(tmp);
  return Math.max(1.2, Math.round(d * 100) / 100);
};

fs.mkdirSync("public", { recursive: true });
await download(p.loop_url, "public/loop.mp4", 50000);
const scenes = [];
for (let i = 0; i < p.scenes.length; i++) {
  const s = p.scenes[i];
  await download(s.image_url, `public/bg-${i}.img`, 5000);
  await download(s.audio_url, `public/vo-${i}.mp3`);
  const sc = { bg: `bg-${i}.img`, audio: `vo-${i}.mp3`, speechSec: speechSec(`public/vo-${i}.mp3`), line: s.line || "", state: s.state };
  if (s.talk_url) { await download(s.talk_url, `public/talk-${i}.mp4`, 50000); sc.talk = `talk-${i}.mp4`; }
  scenes.push(sc);
}
const props = { title: p.title, titleSec: p.titleSec ?? 2.5, side: p.side === "L" ? "L" : "R", loop: "loop.mp4", bed: "bed.wav", scenes };
fs.writeFileSync("props.json", JSON.stringify(props, null, 2));

// mirror storyTimeline() for the bed + SFX cut list
const FPS = 30;
let at = 0; const cuts = [];
scenes.forEach((s, i) => { if (i) cuts.push(at); at += Math.max(Math.round((s.speechSec + 0.25) * FPS), 2 * FPS); });
cuts.unshift(Math.round(props.titleSec * FPS)); // title-out whoosh
const runKey = String(p.run_key).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
const env = [`RUN_KEY=${runKey}`, `FRAMES=${at + 12}`, `CUTS=${[...new Set(cuts)].sort((a, b) => a - b).join(",")}`, `FILE=${runKey}.mp4`, `CALLBACK=${p.callback || ""}`].join("\n");
if (p.callback) console.log(`::add-mask::${p.callback}`);
fs.appendFileSync(process.env.GITHUB_ENV, env + "\n");
console.log(env.split("\n").filter((l) => !l.startsWith("CALLBACK=")).join("\n"));
console.log(JSON.stringify(scenes.map((s) => [s.state, s.speechSec, s.line])));
