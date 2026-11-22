import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";

// Story / Tri News reel with an animal presenter that moves between states:
//   full   = presenter fills the frame (talking clip), slow push-in
//   circle = teal-ringed circle in a lower corner over the B-roll (listening loop)
//   split  = B-roll on top, presenter on the bottom 45 %
//   none   = B-roll only
// The intro title lives only for titleSec, then wipes out; each scene gets a kinetic keyword.

export type PresenterState = "full" | "circle" | "split" | "none";
export type StoryScene = {
  bg: string; // image or video file in public/ (B-roll)
  bgVideo?: boolean;
  audio: string; // voice for this scene in public/
  speechSec: number; // spoken length (silence trimmed)
  line: string; // on-screen keyword line
  state: PresenterState;
  talk?: string; // talking presenter clip (used when state = full)
};
export type StoryReelProps = {
  title: string;
  scenes: StoryScene[];
  loop: string; // listening loop (circle / split, and full when no talk clip)
  side: "R" | "L";
  titleSec: number;
  bed?: string;
};

const FPS = 30;
const GAP = 0.25; // breath between lines (s)
const TR = 10; // presenter morph length (frames)
const W = 1080;
const H = 1920;
const SANS = "Inter, Helvetica, Arial, sans-serif";
const TEAL = "#4ECDC4";
const CORAL = "#FF6B6B";

export const storyTimeline = (p: StoryReelProps) => {
  let at = 0;
  const scenes = p.scenes.map((s) => {
    const len = Math.max(Math.round((s.speechSec + GAP) * FPS), 2 * FPS);
    const out = { ...s, from: at, len };
    at += len;
    return out;
  });
  return { total: at + 12, scenes, cuts: scenes.slice(1).map((s) => s.from) };
};

type Rect = { x: number; y: number; w: number; h: number; r: number; ring: number; o: number };
const rectFor = (state: PresenterState, side: "R" | "L"): Rect => {
  const size = 340;
  const cx = side === "R" ? W - size - 44 : 44;
  switch (state) {
    case "full":
      return { x: 0, y: 0, w: W, h: H, r: 0, ring: 0, o: 1 };
    case "split":
      return { x: 0, y: Math.round(H * 0.55), w: W, h: Math.round(H * 0.45), r: 0, ring: 0, o: 1 };
    case "circle":
      return { x: cx, y: H - size - 430, w: size, h: size, r: size / 2, ring: 9, o: 1 };
    case "none":
      return { x: cx + size / 2, y: H - 430 - size / 2, w: 0, h: 0, r: 0, ring: 9, o: 0 };
  }
};
const mix = (a: Rect, b: Rect, t: number): Rect => {
  const l = (k: keyof Rect) => a[k] + (b[k] - a[k]) * t;
  return { x: l("x"), y: l("y"), w: l("w"), h: l("h"), r: l("r"), ring: l("ring"), o: l("o") };
};

const outline = (px: number) =>
  `${px}px ${px}px 0 #000, -${px}px ${px}px 0 #000, ${px}px -${px}px 0 #000, -${px}px -${px}px 0 #000, 0 ${px * 2}px ${px * 3}px rgba(0,0,0,.45)`;

const Broll: React.FC<{ src: string; video?: boolean; len: number }> = ({ src, video, len }) => {
  const f = useCurrentFrame();
  const scale = interpolate(f, [0, len], [1.04, 1.14]);
  const fade = interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` };
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {video ? <OffthreadVideo src={staticFile(src)} muted style={style} /> : <Img src={staticFile(src)} style={style} />}
    </AbsoluteFill>
  );
};

const Presenter: React.FC<{ prev: PresenterState; state: PresenterState; src: string; side: "R" | "L"; len: number }> = ({
  prev,
  state,
  src,
  side,
  len,
}) => {
  const f = useCurrentFrame();
  const t = spring({ frame: f, fps: FPS, config: { damping: 15, stiffness: 140 }, durationInFrames: TR });
  const r = mix(rectFor(prev, side), rectFor(state, side), t);
  if (state === "none" && t >= 0.999) return null;
  const push = state === "full" ? interpolate(f, [0, len], [1, 1.07]) : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: r.r,
        overflow: "hidden",
        opacity: r.o,
        boxShadow: r.ring > 0.5 ? `0 0 0 ${r.ring}px ${TEAL}, 0 18px 40px rgba(0,0,0,.45)` : "none",
        background: "#0e1416",
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${push})` }}
      />
    </div>
  );
};

const Title: React.FC<{ text: string; outAt: number }> = ({ text, outAt }) => {
  const f = useCurrentFrame();
  const inS = spring({ frame: f, fps: FPS, config: { damping: 12 } });
  const outS = spring({ frame: f - outAt, fps: FPS, config: { damping: 16 } });
  if (f > outAt + 20) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 230,
        left: 60,
        right: 60,
        textAlign: "center",
        transform: `translateY(${-outS * 420}px) scale(${0.85 + 0.15 * inS})`,
        opacity: 1 - outS,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: text.length > 22 ? 96 : 112,
          lineHeight: 1.0,
          color: "#fff",
          textTransform: "uppercase",
          textShadow: outline(6),
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Kinetic keyword: words land one by one, the longest word is the coloured keyword.
const Keyword: React.FC<{ text: string; state: PresenterState; delay: number }> = ({ text, state, delay }) => {
  const f = useCurrentFrame() - delay;
  if (!text || f < 0) return null;
  const words = text.split(/\s+/).filter(Boolean);
  const key = words.reduce((a, b) => (b.length > a.length ? b : a), "");
  const top = state === "full" ? 1180 : state === "split" ? 820 : 300;
  return (
    <div style={{ position: "absolute", top, left: 60, right: 60, textAlign: "center", lineHeight: 1.05 }}>
      {words.map((w, i) => {
        const s = spring({ frame: f - i * 4, fps: FPS, config: { damping: 11, stiffness: 160 } });
        const isKey = w === key;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              margin: "0 12px",
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: isKey ? 118 : 74,
              color: isKey ? CORAL : "#fff",
              textTransform: "uppercase",
              textShadow: outline(isKey ? 5 : 4),
              opacity: s,
              transform: `translateY(${(1 - s) * 60}px) scale(${0.7 + 0.3 * s})`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const StoryReel: React.FC<StoryReelProps> = (p) => {
  const t = storyTimeline(p);
  const titleOut = Math.round(p.titleSec * FPS);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0e1416" }}>
      {t.scenes.map((s, i) => {
        const prev = i === 0 ? "full" : t.scenes[i - 1].state;
        const src = s.state === "full" && s.talk ? s.talk : p.loop;
        // scene 1 keyword waits for the title to leave
        const delay = i === 0 ? Math.max(0, titleOut - s.from + 6) : 6;
        return (
          <Sequence key={i} from={s.from} durationInFrames={s.len + (i === t.scenes.length - 1 ? 12 : 0)}>
            {s.state !== "full" && (
              <AbsoluteFill style={s.state === "split" ? { height: "56%", overflow: "hidden" } : undefined}>
                <Broll src={s.bg} video={s.bgVideo} len={s.len} />
              </AbsoluteFill>
            )}
            <Presenter prev={prev} state={s.state} src={src} side={p.side} len={s.len} />
            <Keyword text={s.line} state={s.state} delay={delay} />
            <Audio src={staticFile(s.audio)} />
          </Sequence>
        );
      })}
      <Title text={p.title} outAt={titleOut} />
      {p.bed ? <Audio src={staticFile(p.bed)} volume={0.12} /> : null}
    </AbsoluteFill>
  );
};
