# Builds the self-contained HyperFrames composition: inlines brand fonts and the agent-bought screenshots as base64.
import base64, pathlib, sys
here = pathlib.Path(__file__).parent
assets = pathlib.Path(sys.argv[1])
b64 = lambda name: base64.b64encode((assets / name).read_bytes()).decode()
html = (here / "teaser.template.html").read_text(encoding="utf-8")
for key, name in {"FONT_MANROPE": "manrope.woff2", "FONT_DMSANS": "dmsans.woff2", "FONT_MONO": "plexmono.woff2", "IMG_DESKTOP": "render_desktop.png", "IMG_NARROW": "render_narrow.png"}.items():
    html = html.replace("{{" + key + "}}", b64(name))
assert "{{" not in html
(here / "launcheck-teaser.html").write_text(html, encoding="utf-8")
print("bytes", len(html.encode()))
