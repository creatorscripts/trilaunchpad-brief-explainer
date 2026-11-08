// Reads the render payload (repository_dispatch client_payload or workflow_dispatch input),
// downloads the race card + voiceover into public/, writes props.json and exports env vars.
import fs from "node:fs";

const raw = process.env.CP && process.env.CP !== "null" && process.env.CP !== "{}" ? process.env.CP : process.env.WD;
if (!raw) throw new Error("No payload: send client_payload or workflow input 'payload'");
let payload = JSON.parse(raw);
if (typeof payload === "string") payload = JSON.parse(payload);
let props = payload.props;
if (typeof props === "string") props = JSON.parse(props);

const need = ["run_key", "vo_url", "card_url"];
for (const k of need) if (!payload[k]) throw new Error(`payload.${k} missing`);
const runKey = String(payload.run_key).replace(/[^a-z0-9-]/gi, "-").toLowerCase();

async function download(url, dest) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`Download failed ${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1000) throw new Error(`Downloaded file too small (${buf.length} B) from ${url}`);
  fs.writeFileSync(dest, buf);
  console.log(`saved ${dest} (${buf.length} B)`);
}

fs.mkdirSync("public", { recursive: true });
await download(payload.card_url, "public/card.png");
await download(payload.vo_url, "public/vo.mp3");

props.card = "card.png";
props.vo = "vo.mp3";
if (!Array.isArray(props.scenes) || props.cuts.length !== props.scenes.length - 1)
  throw new Error(`scenes/cuts mismatch: ${props.scenes?.length} scenes, ${props.cuts?.length} cuts`);
fs.writeFileSync("props.json", JSON.stringify(props, null, 2));
fs.writeFileSync("payload.json", JSON.stringify(payload, null, 2));

const frames = Math.round(props.totalSec * 30);
const cuts = props.cuts.map((c) => Math.round(c * 30)).join(",");
const env = [
  `RUN_KEY=${runKey}`,
  `FRAMES=${frames}`,
  `CUTS=${cuts}`,
  `CALLBACK=${payload.callback || ""}`,
  `FILE=${runKey}.mp4`,
].join("\n");
fs.appendFileSync(process.env.GITHUB_ENV, env + "\n");
console.log(env);
