"""Exact-browser VFX label/HUD visibility runner (VFX-owned).

This file is a runnable QA handoff, NOT a substitute for independent QA signoff.
QA owns the CI invocation in scripts/ or tests/qa/ and the Actions wiring.

Prerequisites (the existing browser-qa CI job already provides these):
  python -m pip install playwright==1.57.0
  python -m playwright install --with-deps chromium webkit
  node scripts/dev-server.mjs

Invocation from repository root:
  python tests/visual/boss_warning_browser_qa.py --browsers chromium webkit

All 60 cases use real drawScene(), real CSS/HUD/boss bar, low quality and
reduced motion. Captured screenshots remain in /tmp until QA uploads artifacts.
No physical-device FPS, real-device touchscreen or gameplay hitbox claim.
"""
import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

SIZES = ((320, 568), (844, 390))
PATTERNS = ((0, "RING"), (1, "FAN"), (2, "STAR"))
EDGES = ("top-left", "top-center", "top-right", "bottom-left", "bottom-right")
DEFAULT_ORIGIN = "http://127.0.0.1:4173"
DEFAULT_SCREENSHOT_DIR = "/tmp/arcana-qa-vfx"

# Executed with the actual game modules served by scripts/dev-server.mjs.
MOUNT_CASE = """async ({pattern, edge}) => {
  const mod = await import('/tests/visual/boss_warning_visual_case.js');
  return mod.mountBossWarningVisualCase({
    pattern, edge, quality: 'low', reducedMotion: true
  });
}"""


def assert_visual_result(result, engine, width, height, pattern, label, edge):
    """Geometry/visibility checks from real browser Canvas text metrics."""
    case = (engine, width, height, label, edge)
    assert result["pattern"] == pattern, (case, "wrong pattern", result)
    assert result["edge"] == edge, (case, "wrong edge", result)
    assert result["label"] == label, (case, "wrong label", result)
    assert result["mode"] == "live-renderer-and-real-hud", (case, result)
    assert result["width"] == width and result["height"] == height, (case, "viewport mismatch", result)
    box = result.get("labelBox")
    assert box is not None, (case, "no observed live Canvas fillText")
    assert box["label"] == label, (case, "wrong Canvas glyph", box)
    assert 0 <= box["left"] < box["right"] <= width, (case, "clipped glyph X", box)
    assert 0 <= box["top"] < box["bottom"] <= height, (case, "clipped glyph Y", box)
    assert not result["occludedBy"], (case, "real HUD hides warning label", result["occludedBy"], box)
    assert result["canvasId"] == "vfx-warning-qa-canvas", (case, "wrong canvas", result)


def run_one(browser, engine, width, height, origin, output_dir):
    # Do not mock DOM overlays, renderer modules, screen breakpoints or fonts.
    page = browser.new_page(
        viewport={"width": width, "height": height},
        has_touch=True,
        is_mobile=True,
        device_scale_factor=1,
        reduced_motion="reduce",
    )
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    successes = 0
    try:
        page.goto(origin, wait_until="networkidle")
        assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
        for pattern, label in PATTERNS:
            for edge in EDGES:
                tag = f"{engine}-{width}x{height}-{label.lower()}-{edge}"
                screenshot = output_dir / (tag + ".png")
                try:
                    result = page.evaluate(MOUNT_CASE, {"pattern": pattern, "edge": edge})
                    assert_visual_result(result, engine, width, height, pattern, label, edge)
                    assert page.locator("#hud").is_visible(), (tag, "production HUD not visible")
                    assert page.locator("#boss-hud").is_visible(), (tag, "production boss bar not visible")
                    # Save actual layered pixels for independent review; NOT just
                    # Canvas anchor coordinates or a synthetic drawn text image.
                    page.locator("#app").screenshot(path=str(screenshot))
                    assert not errors, (tag, "browser script error", errors)
                    print("QA_VFX_PASS " + json.dumps({
                        "case": tag, "labelBox": result["labelBox"],
                        "occludedBy": result["occludedBy"],
                        "screenshot": str(screenshot),
                    }, sort_keys=True), flush=True)
                    successes += 1
                except Exception as error:
                    print("QA_VFX_FAIL " + json.dumps({
                        "case": tag, "reason": repr(error),
                        "screenshot": str(screenshot),
                        "pageerrors": errors,
                    }, sort_keys=True), flush=True)
                    try:
                        page.locator("#app").screenshot(path=str(screenshot), timeout=3500)
                        print("QA_VFX_FAILURE_SCREENSHOT " + str(screenshot), flush=True)
                    except Exception as capture_error:
                        print("QA_VFX_SCREENSHOT_UNAVAILABLE " + repr(capture_error), flush=True)
                    raise
        return successes
    finally:
        page.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browsers", nargs="+", choices=("chromium", "webkit"),
                        default=("chromium", "webkit"))
    parser.add_argument("--origin", default=os.environ.get("ARCANA_QA_URL", DEFAULT_ORIGIN))
    parser.add_argument("--screenshots", default=DEFAULT_SCREENSHOT_DIR)
    args = parser.parse_args()
    output = Path(args.screenshots).resolve()
    output.mkdir(parents=True, exist_ok=True)
    cases = 0
    with sync_playwright() as playwright:
        for engine in args.browsers:
            browser = getattr(playwright, engine).launch(headless=True)
            try:
                for width, height in SIZES:
                    cases += run_one(browser, engine, width, height, args.origin, output)
            finally:
                browser.close()
    expected = len(args.browsers) * len(SIZES) * len(PATTERNS) * len(EDGES)
    assert cases == expected, ("incomplete VFX browser matrix", cases, expected)
    print("QA_VFX_BROWSER_MATRIX_COMPLETE " + json.dumps({
        "total": cases, "browsers": args.browsers,
        "screenshots": str(output), "hardware_fps": "NOT VERIFIED",
        "independent_pixel_review": "PENDING",
    }, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
