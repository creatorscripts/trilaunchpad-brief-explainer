import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  Img,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "@fontsource/fraunces/700.css";
import "@fontsource/fraunces/900.css";
import "@fontsource/fraunces/700-italic.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

// ---- Brand tokens (TriLaunchpad editorial) ----
const C = {
  cream: "#F3ECE0",
  paper: "#FBF7F0",
  ink: "#1E2B2F",
  muted: "#6B6A63",
  terra: "#C65D3B",
  swim: "#2F7E8A",
  bike: "#D99A2B",
  run: "#5E8C5A",
};
const SERIF = "Fraunces, Georgia, serif";
const SANS = "Inter, Helvetica, Arial, sans-serif";

type Leg = { disc: string; dist: number; unit: string; note: string };
export type BriefProps = {
  name: string;
  dateLine: string;
  place: string;
  type: string;
  legs: Leg[];
  beginnerFit: number;
  hook: string[];
  spotlightTitle: string[];
  spotlightTrap: string;
  costLow: number;
  costHigh: number;
  costNote: string;
  unverified: string[];
  url: string;
  card: string;
  vo: string;
  scenes: string[]; // scene order, one per voice line
  cuts: number[]; // seconds where each next scene begins (length = scenes - 1)
  totalSec: number;
  legCues?: number[]; // seconds (relative to legs scene) when each leg is spoken
  kicker?: string; // hook kicker, e.g. "Race brief · 16 weeks out"
  legsTitle?: string;
  spotlightDisc?: string; // SWIM | BIKE | RUN
  currency?: string;
  ctaTitle?: string;
};

// ---- Timeline (frames @30fps), driven by the voiceover line boundaries ----
const FPS = 30;
const XF = 10;
const DEFAULT_ORDER = ["card", "hook", "legs", "spotlight", "fit", "cost", "check", "cta"];
export const timeline = (p: BriefProps) => {
  const ORDER = p.scenes && p.scenes.length ? p.scenes : DEFAULT_ORDER;
  const total = Math.round(p.totalSec * FPS);
  const starts = [0, ...p.cuts.map((c) => Math.round(c * FPS) - XF / 2)];
  const scenes = ORDER.map((id, i) => {
    const end = i < ORDER.length - 1 ? starts[i + 1] + XF : total;
    return { id, from: starts[i], len: end - starts[i] };
  });
  return { total, scenes };
};

const discColor = (d: string) =>
  d === "SWIM" ? C.swim : d === "BIKE" ? C.bike : C.run;

// Scene wrapper: crossfade + gentle push-in
const Scene: React.FC<{ len: number; children: React.ReactNode; bg?: string }> = ({
  len,
  children,
  bg = C.cream,
}) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, XF, len - XF, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(f, [0, len], [1.0, 1.035]);
  return (
    <AbsoluteFill style={{ opacity, background: bg }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// Word/line reveal
const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  delay = 0,
  children,
  style,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 60}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Kicker: React.FC<{ text: string; color?: string; delay?: number }> = ({
  text,
  color = C.terra,
  delay = 0,
}) => (
  <Rise delay={delay}>
    <div
      style={{
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: 34,
        letterSpacing: 6,
        color,
        textTransform: "uppercase",
      }}
    >
      {text}
    </div>
  </Rise>
);

const Pad: React.FC<{ children: React.ReactNode; justify?: string }> = ({
  children,
  justify = "center",
}) => (
  <AbsoluteFill style={{ padding: "220px 96px 260px", justifyContent: justify as any }}>
    {children}
  </AbsoluteFill>
);

// ---------------- Scenes ----------------
const Hook: React.FC<BriefProps> = ({ hook, kicker }) => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [8, 60], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <Pad>
      <Kicker text={kicker || "Race brief · first-timer read"} />
      <div style={{ height: 40 }} />
      {hook.map((line, i) => (
        <Rise key={i} delay={6 + i * 8}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 900,
              fontSize: i === hook.length - 1 ? 150 : 112,
              lineHeight: 1.02,
              color: i === hook.length - 1 ? C.swim : C.ink,
              fontStyle: i === hook.length - 1 ? "italic" : "normal",
            }}
          >
            {line}
          </div>
        </Rise>
      ))}
      <svg width="888" height="120" style={{ marginTop: 50 }}>
        <path
          d="M0 60 C 110 0, 220 120, 330 60 S 550 0, 660 60 S 820 110, 888 60"
          stroke={C.swim}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
    </Pad>
  );
};

const fmtDist = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n).toLocaleString("en-US") : n.toFixed(1));
const Legs: React.FC<BriefProps> = ({ legs, legCues, legsTitle }) => {
  const { durationInFrames } = useVideoConfig();
  const sceneLen = Math.min(durationInFrames, 160);
  const cue = (i: number) =>
    legCues?.[i] != null
      ? Math.max(0, Math.round(legCues[i] * 30) - 6)
      : Math.round(8 + (i * (sceneLen * 0.55)) / Math.max(1, legs.length - 1));
  const f = useCurrentFrame();
  const total = legs.reduce((a, l) => a + (l.unit === "m" ? l.dist / 1000 : l.dist), 0);
  return (
    <Pad>
      <Kicker text={legsTitle || "The three legs"} />
      <div style={{ height: 50 }} />
      {legs.map((l, i) => {
        const d0 = cue(i);
        const p = interpolate(f, [d0, d0 + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const val = l.dist * p;
        const col = discColor(l.disc);
        return (
          <Rise key={l.disc} delay={d0}>
            <div style={{ marginBottom: 54 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, letterSpacing: 4, color: col }}>
                  {l.disc}
                </div>
                <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 150, color: C.ink, lineHeight: 1 }}>
                  {p < 1 ? fmtDist(Math.floor(val)) : fmtDist(l.dist)}
                  <span style={{ fontSize: 70, marginLeft: 12 }}>{l.unit}</span>
                </div>
              </div>
              <div style={{ height: 14, background: "#E3D9C9", borderRadius: 7, marginTop: 10 }}>
                <div style={{ height: 14, width: `${p * 100}%`, background: col, borderRadius: 7 }} />
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 34, color: C.muted, marginTop: 14 }}>
                {l.note}
              </div>
            </div>
          </Rise>
        );
      })}
      <Rise delay={cue(legs.length - 1) + 40}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 60, color: C.terra }}>
          {total.toFixed(2).replace(/\.?0+$/, "")} km, one finish line.
        </div>
      </Rise>
    </Pad>
  );
};

const Waves: React.FC = () => {
  const f = useCurrentFrame();
  const rows = [0, 1, 2, 3, 4, 5];
  return (
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      {rows.map((r) => {
        const y = 1250 + r * 95;
        const ph = f * 0.09 + r * 0.9;
        let d = `M -40 ${y}`;
        for (let x = -40; x <= 1120; x += 40) {
          d += ` L ${x} ${y + Math.sin(x / 120 + ph) * 22}`;
        }
        return (
          <path key={r} d={d} stroke={C.paper} strokeOpacity={0.18 + r * 0.06} strokeWidth={8} fill="none" />
        );
      })}
    </svg>
  );
};

const SpeedLines: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((r) => {
        const y = 1230 + r * 85;
        const len = 260 + ((r * 137) % 220);
        const x = ((f * (14 + r * 3) + r * 300) % 1500) - 400;
        return <line key={r} x1={x} y1={y} x2={x + len} y2={y} stroke={C.paper} strokeOpacity={0.25 + (r % 3) * 0.12} strokeWidth={8} strokeLinecap="round" />;
      })}
    </svg>
  );
};

const Spotlight: React.FC<BriefProps> = ({ spotlightTitle, spotlightTrap, spotlightDisc }) => {
  const f = useCurrentFrame();
  const disc = (spotlightDisc || "SWIM").toUpperCase();
  const arrowX = interpolate(f, [0, 110], [-200, 1200]);
  return (
    <>
      <AbsoluteFill style={{ background: disc === "SWIM" ? C.swim : disc === "BIKE" ? "#B9791A" : C.run }} />
      {disc === "SWIM" ? <Waves /> : <SpeedLines />}
      <div
        style={{
          position: "absolute",
          top: 1180,
          left: arrowX,
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: 6,
          color: C.paper,
          opacity: 0.85,
        }}
      >
        {disc === "SWIM" ? "CURRENT →" : disc === "BIKE" ? "KEEP SPINNING →" : "ONE STEP AT A TIME →"}
      </div>
      <Pad justify="flex-start">
        <Kicker text={`${disc.toLowerCase()} spotlight`} color={C.paper} />
        <div style={{ height: 30 }} />
        {spotlightTitle.map((t, i) => (
          <Rise key={i} delay={6 + i * 8}>
            <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 124, lineHeight: 1.02, color: C.paper }}>
              {t}
            </div>
          </Rise>
        ))}
        <Rise delay={36}>
          <div
            style={{
              marginTop: 60,
              background: C.paper,
              color: C.ink,
              borderRadius: 28,
              padding: "36px 40px",
              fontFamily: SANS,
              fontWeight: 500,
              fontSize: 44,
              lineHeight: 1.3,
              borderLeft: `14px solid ${C.terra}`,
            }}
          >
            <b style={{ fontWeight: 800 }}>Beginner trap: </b>
            {spotlightTrap}
          </div>
        </Rise>
      </Pad>
    </>
  );
};

const Fit: React.FC<BriefProps> = ({ beginnerFit }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Pad>
      <Kicker text="Beginner fit" />
      <Rise delay={4}>
        <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 330, color: C.ink, lineHeight: 1 }}>
          {beginnerFit}
          <span style={{ fontSize: 140, color: C.muted }}>/5</span>
        </div>
      </Rise>
      <div style={{ display: "flex", gap: 30, marginTop: 30 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const s = spring({ frame: f - 14 - i * 6, fps, config: { damping: 10 } });
          const on = i < beginnerFit;
          return (
            <div
              key={i}
              style={{
                width: 130,
                height: 130,
                borderRadius: 65,
                background: on ? C.terra : "#E3D9C9",
                transform: `scale(${s})`,
              }}
            />
          );
        })}
      </div>
      <Rise delay={46}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 48, color: C.ink, marginTop: 60, lineHeight: 1.3 }}>
          The friendliest distance. A great first race.
        </div>
      </Rise>
    </Pad>
  );
};

const Cost: React.FC<BriefProps> = ({ costLow, costHigh, costNote, currency }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [8, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fmt = (n: number) => Math.round((n * p) / 100) * 100;
  return (
    <Pad>
      <Kicker text="Weekend budget (estimate)" />
      <Rise delay={4}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, color: C.muted, marginTop: 40 }}>{currency || "MXN"}</div>
        <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 176, color: C.ink, lineHeight: 1 }}>
          {fmt(costLow).toLocaleString("en-US")}
        </div>
        <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 176, color: C.terra, lineHeight: 1 }}>
          – {fmt(costHigh).toLocaleString("en-US")}
        </div>
      </Rise>
      <Rise delay={30}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 46, color: C.ink, marginTop: 50 }}>{costNote}</div>
      </Rise>
    </Pad>
  );
};

const Check: React.FC<BriefProps> = ({ unverified }) => (
  <Pad>
    <Kicker text="Honest note" />
    <Rise delay={4}>
      <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 104, color: C.ink, lineHeight: 1.05, marginTop: 30 }}>
        Not verified yet.
      </div>
    </Rise>
    <div style={{ height: 50 }} />
    {unverified.map((u, i) => (
      <Rise key={u} delay={18 + i * 10}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, marginBottom: 38 }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              border: `6px solid ${C.terra}`,
              color: C.terra,
              fontFamily: SERIF,
              fontWeight: 900,
              fontSize: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ?
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 58, color: C.ink }}>{u}</div>
        </div>
      </Rise>
    ))}
    <Rise delay={56}>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 56, color: C.terra, marginTop: 20 }}>
        Check before you train.
      </div>
    </Rise>
  </Pad>
);

const Cta: React.FC<BriefProps> = ({ url, name, ctaTitle }) => (
  <>
    <AbsoluteFill style={{ background: C.ink }} />
    <Pad>
      <Kicker text="Full race brief" color={C.bike} />
      <Rise delay={4}>
        <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 116, color: C.paper, lineHeight: 1.05, marginTop: 30 }}>
          {ctaTitle || `Course, costs, countdown — all of ${name}.`}
        </div>
      </Rise>
      <Rise delay={22}>
        <div
          style={{
            marginTop: 70,
            display: "inline-flex",
            background: C.terra,
            color: C.paper,
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 64,
            padding: "28px 46px",
            borderRadius: 999,
          }}
        >
          {url} →
        </div>
      </Rise>
      <Rise delay={36}>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 40, color: "#C9C2B5", marginTop: 70 }}>
          TriLaunchpad · Your triathlon journey starts here
        </div>
      </Rise>
    </Pad>
  </>
);

// Opening shot: start tight on the race-card map pin, pull out to reveal the card
const CardOpen: React.FC<BriefProps> = ({ card }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, 95], [2.6, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const W = 1000;
  const H = 1500;
  const s = 1080 / W; // fit width
  const ch = H * s;
  const top = (1920 - ch) / 2;
  // pin position on the card (px in card space)
  const px = 500 * s;
  const py = 410 * s;
  return (
    <AbsoluteFill style={{ background: C.cream, overflow: "hidden" }}>
      <Img
        src={staticFile(card)}
        style={{ position: "absolute", inset: -60, width: 1200, height: 2040, objectFit: "cover", filter: "blur(40px) saturate(0.9)", opacity: 0.55 }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top,
          width: 1080,
          height: ch,
          transformOrigin: `${px}px ${py}px`,
          transform: `scale(${z})`,
          boxShadow: "0 30px 80px rgba(30,43,47,.25)",
        }}
      >
        <Img src={staticFile(card)} style={{ width: 1080, height: ch }} />
      </div>
    </AbsoluteFill>
  );
};

// Persistent chrome: brand tag + progress line (hidden on the card, which has its own logo)
const Chrome: React.FC<{ total: number; scenes: { id: string; from: number; len: number }[] }> = ({
  total,
  scenes,
}) => {
  const f = useCurrentFrame();
  const at = (id: string) => scenes.find((s) => s.id === id) || scenes[Math.min(1, scenes.length - 1)];
  const inScene = (id: string) => {
    const s = at(id);
    return f > s.from + XF / 2 && f < s.from + s.len - XF / 2;
  };
  const vis = interpolate(f, [at("hook").from, at("hook").from + XF], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dark = (scenes.some((s) => s.id === "spotlight") && inScene("spotlight")) || f > at("cta").from + XF / 2;
  const col = dark ? C.paper : C.ink;
  return (
    <div style={{ opacity: vis }}>
      <div style={{ position: "absolute", top: 110, left: 96, fontFamily: SANS, fontWeight: 800, fontSize: 30, letterSpacing: 5, color: col }}>
        TRILAUNCHPAD
      </div>
      <div style={{ position: "absolute", bottom: 150, left: 96, right: 96, height: 8, background: dark ? "rgba(255,255,255,.2)" : "#E3D9C9", borderRadius: 4 }}>
        <div style={{ width: `${(f / total) * 100}%`, height: 8, background: C.terra, borderRadius: 4 }} />
      </div>
    </div>
  );
};

const MAP: Record<string, React.FC<BriefProps>> = {
  card: CardOpen,
  hook: Hook,
  legs: Legs,
  spotlight: Spotlight,
  swim: Spotlight,
  fit: Fit,
  cost: Cost,
  check: Check,
  cta: Cta,
};

export const BriefExplainer: React.FC<BriefProps> = (props) => {
  const { total, scenes } = timeline(props);
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      {scenes.map((s) => {
        const Comp = MAP[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.len}>
            <Scene len={s.len}>
              <Comp {...props} />
            </Scene>
          </Sequence>
        );
      })}
      <Chrome total={total} scenes={scenes} />
      <Audio src={staticFile(props.vo)} />
      <Audio src={staticFile("bed.wav")} volume={0.32} />
    </AbsoluteFill>
  );
};
