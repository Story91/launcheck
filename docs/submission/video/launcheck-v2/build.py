# Builds the LaunCheck v2 teaser as two HyperFrames projects (landscape 1920x1080, portrait 1080x1920).
# Sources: assets/ (fonts, real app screenshots, generated VO/music/AI shots) and the word timings in captions.json.
# Usage: python -I build.py  ->  landscape/index.html, portrait/index.html (assets copied next to each).
import json, pathlib, shutil

HERE = pathlib.Path(__file__).parent
VO = 0.2  # voiceover start offset in the composition
DUR = 23.0

words = json.loads((HERE / "captions.json").read_text(encoding="utf-8"))
# Caption groups: (first word index, last word index inclusive, end time)
GROUPS = [(0, 5, 1.86), (6, 12, 3.72), (13, 16, 5.12), (17, 24, 8.42), (25, 28, 10.96),
          (29, 31, 12.48), (32, 37, 14.0), (38, 43, 15.98), (44, 45, 17.0)]
HL = {"AI", "budget", "launch.", "checks,", "USDC", "base.", "real", "10", "cent", "half.", "Six"}
FIX = {"base.": "Base.", "10": "10"}

def captions():
    html, js = [], []
    for g, (a, b, end) in enumerate(GROUPS):
        start = words[a]["start"] + VO - 0.05
        spans = []
        for i in range(a, b + 1):
            w = words[i]
            t = FIX.get(w["text"], w["text"])
            cls = "w hl" if w["text"] in HL else "w"
            spans.append(f'<span class="{cls}" id="w{i}">{t}</span>')
            js.append(f'tl.from("#w{i}", {{ y: 46, opacity: 0, scale: 0.7, duration: 0.2, ease: "back.out(2.4)" }}, {w["start"] + VO:.2f});')
        html.append(f'      <div class="capline clip" id="cap{g}" data-start="{start:.2f}" data-duration="{end - start:.2f}" data-track-index="5">{" ".join(spans)}</div>')
    return "\n".join(html), "\n      ".join(js)

SFX = [("impact-bass-1", 0.05, 0.5), ("whoosh-short", 3.62, 0.45), ("pop", 4.05, 0.28), ("pop", 4.3, 0.28), ("pop", 4.55, 0.28), ("pop", 4.8, 0.28),
       ("whoosh-short", 5.08, 0.45), ("typing", 5.5, 0.3), ("typing", 6.6, 0.3), ("click", 7.85, 0.6), ("whoosh-short", 8.33, 0.45), ("pop", 8.62, 0.3),
       ("ping", 9.66, 0.3), ("whoosh-short", 10.83, 0.45), ("impact-bass-1", 11.08, 0.6), ("glitch-1", 12.5, 0.3), ("whoosh-short", 13.88, 0.45),
       ("sparkle", 16.04, 0.4), ("click", 16.06, 0.5), ("whoosh-short", 16.88, 0.45), ("impact-bass-2", 16.75, 0.55), ("pop", 20.6, 0.3)]

def audio():
    out = ['      <audio id="vo" class="clip" src="assets/gen/vo.mp3" data-start="0.2" data-track-index="8" data-volume="1"></audio>',
           '      <audio id="music" class="clip" src="assets/gen/music.mp3" data-start="0" data-duration="23" data-track-index="9" data-volume="1" data-fade-out="1.2"'
           ' data-automation=\'{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":0.6},{"t":0.4,"v":0.26},{"t":20.9,"v":0.26},{"t":21.3,"v":0.6}]}]}\'></audio>']
    for i, (n, t, v) in enumerate(SFX):
        out.append(f'      <audio id="sfx{i:02d}" class="clip" src="assets/sfx/{n}.mp3" data-start="{t}" data-track-index="{10 + i}" data-volume="{v}"></audio>')
    return "\n".join(out)

def build(kind, w, h):
    caps_html, caps_js = captions()
    tpl = (HERE / "template.html").read_text(encoding="utf-8")
    html = (tpl.replace("{{W}}", str(w)).replace("{{H}}", str(h)).replace("{{KIND}}", kind)
               .replace("{{AR}}", "16x9" if kind == "land" else "9x16").replace("{{DUR}}", str(DUR))
               .replace("{{CAPTIONS}}", caps_html).replace("{{CAPTIONS_JS}}", caps_js).replace("{{AUDIO}}", audio()))
    assert "{{" not in html
    out = HERE / ("landscape" if kind == "land" else "portrait")
    out.mkdir(exist_ok=True)
    shutil.copytree(HERE / "assets", out / "assets", dirs_exist_ok=True)
    (out / "index.html").write_text(html, encoding="utf-8", newline="\n")
    print("wrote", out / "index.html")

build("land", 1920, 1080)
build("port", 1080, 1920)
