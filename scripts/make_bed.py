"""Synthesize a simple music bed + cut whooshes for the brief explainer test.
Usage: python3 make_bed.py out.wav total_frames cut_frames_csv
"""
import sys, wave
import numpy as np

out, total_frames, cuts = sys.argv[1], int(sys.argv[2]), [int(c) for c in sys.argv[3].split(",")]
SR, FPS, BPM = 44100, 30, 104
dur = total_frames / FPS
n = int(SR * dur)
t = np.arange(n) / SR
mix = np.zeros(n)
beat = 60 / BPM

def note(f):
    return 440 * 2 ** ((f - 69) / 12)

# Warm pad: Am - F - C - G, 2 bars each
prog = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]]
bar = beat * 4
for i in range(int(dur / (bar * 2)) + 1):
    chord = prog[i % 4]
    s, e = int(i * bar * 2 * SR), min(n, int((i + 1) * bar * 2 * SR))
    if s >= n:
        break
    seg = t[s:e] - t[s]
    env = np.minimum(1, seg / 0.6) * np.minimum(1, (seg[-1] - seg + 1e-3) / 0.6)
    for m in chord:
        f = note(m)
        mix[s:e] += 0.05 * env * (np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(2 * np.pi * f * 2.003 * seg))
    # bass root
    mix[s:e] += 0.08 * env * np.sin(2 * np.pi * note(chord[0] - 12) * seg)

# Plucked arpeggio, 8th notes
for k in range(int(dur / (beat / 2))):
    chord = prog[int(k * beat / 2 / (bar * 2)) % 4]
    m = chord[k % 3] + 12
    s = int(k * beat / 2 * SR)
    L = int(0.35 * SR)
    seg = np.arange(min(L, n - s)) / SR
    if len(seg) == 0:
        break
    mix[s:s + len(seg)] += 0.06 * np.exp(-seg * 9) * np.sin(2 * np.pi * note(m) * seg)

# Kick on 1 and 3, hat on off-beats (start after the hook)
for k in range(int(dur / beat)):
    s = int(k * beat * SR)
    if k * beat < 1.2:
        continue
    if k % 2 == 0:
        L = int(0.25 * SR); seg = np.arange(min(L, n - s)) / SR
        f = 110 * np.exp(-seg * 18) + 45
        mix[s:s + len(seg)] += 0.35 * np.exp(-seg * 12) * np.sin(2 * np.pi * np.cumsum(f) / SR)
    hs = int((k + 0.5) * beat * SR)
    L = int(0.05 * SR); seg = np.arange(min(L, max(0, n - hs))) / SR
    if len(seg):
        mix[hs:hs + len(seg)] += 0.04 * np.exp(-seg * 80) * np.random.uniform(-1, 1, len(seg))

# Whoosh on each cut (filtered noise swell centred on the cut)
rng = np.random.default_rng(3)
for c in cuts:
    center = c / FPS
    s, e = int((center - 0.35) * SR), int((center + 0.2) * SR)
    s, e = max(0, s), min(n, e)
    L = e - s
    noise = rng.uniform(-1, 1, L)
    kern = np.ones(12) / 12
    noise = np.convolve(noise, kern, mode="same")
    env = np.sin(np.linspace(0, np.pi, L)) ** 2
    mix[s:e] += 0.22 * env * noise

# Fade in/out, normalize
fade = int(0.4 * SR)
mix[:fade] *= np.linspace(0, 1, fade)
mix[-int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR))
mix /= np.max(np.abs(mix)) * 1.15
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, "w") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, round(dur, 2), "s")
