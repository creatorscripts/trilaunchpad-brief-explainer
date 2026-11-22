// Story reel (presenter choreography). Downloads B-roll clips, per-shot voice, the listening loop and
// talking clips into public/, measures each line's spoken length, picks the presenter state per shot,
// writes props.json + GITHUB_ENV.
//
// Live payload (Make poller 4982957, repository_dispatch "render-story"):
//   { run_key, title, shots, clips, talks, keys, loop_url, side, callback, passthrough }
//   shots  = raw shot table, one line per shot: lumaId|image|audio|line|ok  (audio = 3rd-last, line = 2nd-last)
//   clips  = "|"-joined B-roll clip URL per shot (1..15, empty allowed)
//   talks  = "|"-joined talking-clip URLs for the 5 key shots (empty if that clip failed)
//   keys   = ","-joined shot numbers (1-based) the 5 talking clips belong to
// Test payload: { run_key, title, loop_url, scenes: [{ image_url, audio_url, line, state, talk_url? }] }
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const raw = process.env.CP && process.env.CP !== "null" && process.env.CP !== "{}" ? process.env.CP : process.env.WD;
if (!raw) throw new Error("No payload");
let p = JSON.parse(raw);
if (typeof p === "string") p = JSON.parse(p);
for (const k of ["run_key", "title", "loop_url"]) if (!p[k]) throw new Error(`payload.${k} missing`);

const url = (v) => {
  v = String(v || "").trim();
  if (!v) return "";
  return /^https?:\/\//.test(v) ? v : `https://drive.google.com/uc?id=${v}&export=download`;
};

// Non-talking shots rotate so the presenter keeps moving: none, circle, none, split ...
const ROTATE = ["none", "circle", "none", "split"];

let plan; // [{ bg, bgVideo, audio, line, state, talk }]
if (Array.isArray(p.scenes)) {
  plan = p.scenes.map((s) => ({ bg: url(s.image_url), bgVideo: false, audio: url(s.audio_url), line: s.line || "", state: s.state, talk: url(s.talk_url) }));
} else {
  const rows = String(p.shots || "").split("\n").map((r) => r.trim()).filter(Boolean);
  if (rows.length < 3) throw new Error(`only ${rows.length} shots`);
  const clips = String(p.clips || "").split("|").map((c) => c.trim());
  const talks = String(p.talks || "").split("|").map((c) => c.trim());
  const keys = String(p.keys || "").split(",").map((k) => parseInt(k, 10));
  const talkFor = {};
  keys.forEach((k, j) => { if (k >= 1 && /^https?:/.test(talks[j] || "") && !talkFor[k]) talkFor[k] = talks[j]; });
  let r = 0;
  plan = rows.map((row, i) => {
    const parts = row.split("|");
    const n = i + 1;
    const clip = /^https?:/.test(clips[i] || "") ? clips[i] : "";
    const talk = talkFor[n] || "";
    return {
      bg: clip || url(parts[1]),
      bgVideo: !!clip,
      still: url(parts[1]),
      audio: url(parts[parts.length - 3]),
      line: (parts[parts.length - 2] || "").trim(),
      state: talk ? "full" : ROTATE[r++ % ROTATE.length],
      talk,
    };
  });
}
plan.forEach((s, i) => { if (!s.audio) throw new Error(`shot ${i + 1}: no audio`); if (!s.bg) throw new Error(`shot ${i + 1}: no background`); });

async function download(u, dest, min = 1000) {
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(u, { redirect: "follow" });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length >= min) { fs.writeFileSync(dest, buf); console.log(`saved ${dest} (${buf.length} B)`); return true; }
        console.log(`${dest}: too small (${buf.length} B), retry ${a}`);
      } else console.log(`${dest}: HTTP ${r.status}, retry ${a}`);
    } catch (e) { console.log(`${dest}: ${e.message}, retry ${a}`); }
    await new Promise((s) => setTimeout(s, 3000 * a));
  }
  return false;
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
if (!(await download(p.loop_url, "public/loop.mp4", 50000))) throw new Error("listening loop download failed");
const scenes = [];
let lastBg = null;
for (let i = 0; i < plan.length; i++) {
  const s = plan[i];
  if (!(await download(s.audio, `public/vo-${i}.mp3`))) throw new Error(`shot ${i + 1}: audio download failed`);
  const bgFile = `bg-${i}.${s.bgVideo ? "mp4" : "img"}`;
  let bg = bgFile, bgVideo = s.bgVideo;
  if (!(await download(s.bg, `public/${bgFile}`, 5000))) {
    if (s.bgVideo && s.still && (await download(s.still, `public/bg-${i}.img`, 5000))) {
      bg = `bg-${i}.img`; bgVideo = false; // clip failed: use the shot's still image
    } else if (lastBg) {
      ({ bg, bgVideo } = lastBg); // reuse the previous shot's background
    } else throw new Error(`shot ${i + 1}: background download failed`);
  }
  lastBg = { bg, bgVideo };
  const sc = { bg, bgVideo, audio: `vo-${i}.mp3`, speechSec: speechSec(`public/vo-${i}.mp3`), line: s.line, state: s.state };
  if (s.talk) {
    if (await download(s.talk, `public/talk-${i}.mp4`, 50000)) sc.talk = `talk-${i}.mp4`;
    else if (sc.state === "full") sc.state = "circle"; // never show the listening loop full screen
  }
  scenes.push(sc);
}
const props = { title: p.title, titleSec: p.titleSec ?? 2.5, side: p.side === "L" ? "L" : "R", loop: "loop.mp4", bed: "bed.wav", scenes };
fs.writeFileSync("props.json", JSON.stringify(props, null, 2));

// mirror storyTimeline() for the bed + SFX cut list
const FPS = 30;
let at = 0; const cuts = [];
scenes.forEach((s, i) => { if (i) cuts.push(at); at += Math.max(Math.round((s.speechSec + 0.25) * FPS), 2 * FPS); });
cuts.push(Math.round(props.titleSec * FPS)); // title-out whoosh
const runKey = String(p.run_key).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
const env = [
  `RUN_KEY=${runKey}`, `FRAMES=${at + 12}`, `CUTS=${[...new Set(cuts)].sort((a, b) => a - b).join(",")}`,
  `FILE=${runKey}.mp4`, `CALLBACK=${p.callback || ""}`, `PASSTHROUGH=${p.passthrough || ""}`,
].join("\n");
if (p.callback) console.log(`::add-mask::${p.callback}`);
fs.appendFileSync(process.env.GITHUB_ENV, env + "\n");
console.log(env.split("\n").filter((l) => !l.startsWith("CALLBACK=")).join("\n"));
console.log(JSON.stringify(scenes.map((s) => [s.state, s.speechSec, s.line])));
