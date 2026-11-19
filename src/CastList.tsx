import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";

// Cartoon cast-list reel ("8 Triathletes in Every ...").
// One animated clip per scene; a numbered label on top, a subtitle at the bottom,
// one voice track per language. Scene 0 is the silent cover with the hook title.

export type CastScene = {
  clip: string; // file in public/ (clip-0.mp4 …)
  label: string; // top label, e.g. "1. THE TOWEL TERRITORY CLAIMER" ("" = none)
  sub: string; // bottom subtitle = the spoken line ("" = none)
};
export type CastListProps = {
  lang: string;
  title: string; // cover hook title
  subline: string; // cover subline
  scenes: CastScene[]; // scenes[0] is the cover
  vo: string; // voice file in public/
  coverSec: number; // length of the silent cover
  cuts: number[]; // voice-time seconds where scenes[2..] begin (length = scenes.length - 2)
  voSec: number; // voice length incl. tail
  clipSec: number; // native clip length (Luma 5 s)
  bed?: string;
};

const FPS = 30;
const XF = 8;
const SANS = "Inter, Helvetica, Arial, sans-serif";

export const castTimeline = (p: CastListProps) => {
  const cover = Math.round(p.coverSec * FPS);
  const total = cover + Math.round(p.voSec * FPS);
  // scene 1 starts with the voice; later scenes start at their voice cuts
  const starts = [0, cover, ...p.cuts.map((c) => cover + Math.round(c * FPS) - XF / 2)];
  const scenes = p.scenes.map((s, i) => {
    const end = i < p.scenes.length - 1 ? starts[i + 1] + XF : total;
    return { ...s, from: starts[i], len: Math.max(end - starts[i], FPS) };
  });
  return { total, cover, scenes };
};

const outline = (px: number) =>
  `${px}px ${px}px 0 #000, -${px}px ${px}px 0 #000, ${px}px -${px}px 0 #000, -${px}px -${px}px 0 #000, 0 ${px * 2}px ${px * 3}px rgba(0,0,0,.45)`;

const Clip: React.FC<{ src: string; len: number; clipSec: number }> = ({ src, len, clipSec }) => {
  const frame = useCurrentFrame();
  // stretch or squeeze the clip to fill the scene, within limits that still look natural
  const rate = Math.min(1.35, Math.max(0.6, (clipSec * FPS) / len));
  const fade = interpolate(frame, [0, XF, len - XF, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        playbackRate={rate}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

const Label: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!text) return null;
  const s = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 250,
        left: 60,
        right: 60,
        textAlign: "center",
        transform: `scale(${0.8 + 0.2 * s})`,
        opacity: s,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: text.length > 30 ? 52 : 60,
          letterSpacing: 1,
          lineHeight: 1.15,
          color: "#FFE14D",
          textShadow: outline(4),
        }}
      >
        {text}
      </span>
    </div>
  );
};

const Subtitle: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  const o = interpolate(frame, [XF, XF + 6, len - XF - 4, len - XF], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 470,
        left: 90,
        right: 90,
        textAlign: "center",
        opacity: o,
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 50,
        lineHeight: 1.25,
        color: "#fff",
        textShadow: outline(3),
      }}
    >
      {text}
    </div>
  );
};

const Cover: React.FC<{ title: string; subline: string }> = ({ title, subline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  return (
    <div style={{ position: "absolute", top: 210, left: 50, right: 50, textAlign: "center" }}>
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: title.length > 40 ? 88 : 100,
          lineHeight: 1.02,
          color: "#fff",
          textTransform: "uppercase",
          textShadow: outline(6),
          transform: `scale(${0.85 + 0.15 * s})`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 54,
          color: "#FFE14D",
          textShadow: outline(4),
          opacity: interpolate(frame, [6, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        {subline}
      </div>
    </div>
  );
};

export const CastList: React.FC<CastListProps> = (p) => {
  const t = castTimeline(p);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {t.scenes.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.len}>
          <Clip src={s.clip} len={s.len} clipSec={p.clipSec} />
          {i === 0 ? <Cover title={p.title} subline={p.subline} /> : <Label text={s.label} />}
          {i > 0 && <Subtitle text={s.sub} len={s.len} />}
        </Sequence>
      ))}
      <Sequence from={t.cover}>
        <Audio src={staticFile(p.vo)} />
      </Sequence>
      {p.bed ? <Audio src={staticFile(p.bed)} volume={0.16} /> : null}
    </AbsoluteFill>
  );
};
