#!/usr/bin/env python3
"""Add a light sound-effects layer (earshot sound bank, made in code) at the scene cuts.

usage: add_sfx.py in.mp4 out.mp4 CUTS_csv_frames preset   (preset: brief | castlist)
Writes out.mp4 with the video copied and the audio = original + effects (no loudness pass:
the workflow's loudnorm step runs after this). Exits non-zero on any problem; the workflow
then falls back to the plain render, so a reel is never blocked by this step.
"""
import json, os, subprocess, sys, tempfile

FPS = 30
src, dst, cuts_csv, preset = sys.argv[1:5]
cuts = [int(c) / FPS for c in cuts_csv.split(",") if c.strip()]

# (sound id, weight, offset seconds from the cut). Weights keep effects under the voice.
PRESETS = {
    "brief": {
        "first": [("whoosh_big/swell", 0.30, 0.0), ("ui_pop/soft", 0.25, 0.43)],
        "mid": [
            [("whoosh_fast/crisp", 0.30, 0.0)],
            [("fit/whoosh.short/bamboo_swish", 0.30, 0.0), ("drip/bloop", 0.22, 0.27)],
            [("cut_hit/air", 0.30, 0.0)],
        ],
        "last": [("reverse_swell/short", 0.30, 0.0), ("ui_pop/wide", 0.25, 0.15)],
    },
    "castlist": {
        "first": [("whoosh_big/thump_airy", 0.32, 0.0), ("ui_pop/boop", 0.28, 0.35)],
        "mid": [
            [("whoosh_fast/crisp", 0.28, 0.0), ("ui_pop/blip", 0.25, 0.30)],
            [("cut_hit/punch", 0.28, 0.0)],
            [("fit/whoosh.short/bamboo_swish", 0.28, 0.0), ("drip/plink", 0.22, 0.30)],
        ],
        "last": [("reverse_swell/short", 0.30, 0.0), ("ui_pop/wide", 0.28, 0.15)],
    },
}
P = PRESETS[preset]

cues = []
for i, t in enumerate(cuts):
    if i == 0:
        group = P["first"]
    elif i == len(cuts) - 1 and len(cuts) > 2:
        group = P["last"]
    else:
        group = P["mid"][(i - 1) % len(P["mid"])]
    cues += [(t + off, sid, w) for sid, w, off in group]

tmp = tempfile.mkdtemp()
cache, inputs, filters = {}, ["-i", src], []
for k, (t, sid, w) in enumerate(cues):
    if sid not in cache:
        wav = os.path.join(tmp, f"s{len(cache)}.wav")
        out = subprocess.run(["earshot", "sfx", "render", sid, "-o", wav, "--json"],
                             check=True, capture_output=True, text=True).stdout
        cache[sid] = (wav, float(json.loads(out)["meta"]["peak_s"]))
    wav, peak = cache[sid]
    ms = max(0, int((t - peak) * 1000))  # land the sound's loudest moment on the cue
    inputs += ["-i", wav]
    filters.append(f"[{k+1}:a]volume={w},adelay={ms}|{ms}[s{k}]")

labels = "".join(f"[s{k}]" for k in range(len(cues)))
filters.append(f"{labels}amix=inputs={len(cues)}:normalize=0[fx]")
filters.append("[0:a][fx]amix=inputs=2:normalize=0:duration=first[a]")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(filters),
                "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "pcm_s16le", dst], check=True)
print(f"sfx: {len(cues)} cues on {len(cuts)} cuts ({preset})")
