"""Browser QA for ARCANA SURVIVOR.
--served: actual HTTP origin (CI); --embedded: sandbox-only injected modules.
Neither test mode is a substitute for real phone hardware QA.
"""
import argparse
import os
import subprocess
from base64 import b64encode
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900)]


def modules_and_html():
    def data_module(source):
        return 'data:text/javascript;base64,' + b64encode(source.encode()).decode()
    engine = data_module((ROOT / 'src/engine.js').read_text())
    storage = data_module((ROOT / 'src/storage.js').read_text())
    audio = data_module((ROOT / 'src/audio.js').read_text())
    render = data_module((ROOT / 'src/render.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './storage.js'", f"from '{storage}'"))
    main = data_module((ROOT / 'src/main.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './render.js'", f"from '{render}'").replace("from './storage.js'", f"from '{storage}'").replace("from './audio.js'", f"from '{audio}'"))
    html = (ROOT / 'index.html').read_text().replace('<link rel="stylesheet" href="./src/styles.css" />', '<style>' + (ROOT / 'src/styles.css').read_text() + '</style>').replace('<script type="module" src="./src/main.js"></script>', '')
    return html, main


def bounds_ok(page, selector, w, h):
    box = page.locator(selector).bounding_box()
    assert box, f'missing bounds for {selector}'
    assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= w + 1 and box['y'] + box['height'] <= h + 1, (selector, w, h, box)


def scenario(browser, browser_name, mode, size, html=None, main=None):
    for w, h in [size]:
        touch_enabled = w < 1000  # 1440x900 exercises actual desktop pointer/keyboard mode.
        page = browser.new_page(viewport={'width': w, 'height': h}, has_touch=touch_enabled, is_mobile=touch_enabled, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        if mode == 'served':
            page.goto(os.environ.get('ARCANA_QA_URL', 'http://127.0.0.1:4173'), wait_until='networkidle')
        else:
            page.set_content(html)
            page.add_script_tag(type='module', content=f'import "{main}"')
        page.locator('[data-action="start"]').wait_for()
        page.locator('[data-action="start"]').focus()
        assert page.evaluate("document.activeElement?.dataset.action") == 'start', (browser_name, w, h, 'keyboard focus unavailable')
        assert page.evaluate("() => { const style = getComputedStyle(document.body); return style.userSelect === 'none' || style.webkitUserSelect === 'none'; }"), (browser_name, w, h, 'OS text selection not prevented')
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (browser_name, w, h, 'horizontal overflow')
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="settings"]').click()
        page.locator('[data-action="vfx"]').click()
        assert page.get_by_text('LOW', exact=True).count() == 1
        page.locator('[data-action="motion"]').click()
        assert page.get_by_text('ON', exact=True).count() == 1
        page.locator('[data-action="sound"]').click()
        assert page.get_by_text('SOUND OFF', exact=True).count() == 1
        page.locator('[data-action="sound"]').click()
        assert page.get_by_text('SOUND ON', exact=True).count() == 1
        page.locator('[data-action="back"]').click()
        page.locator('[data-action="start"]').click()
        assert page.locator('#overlay').is_hidden()
        assert page.locator('#hud').is_visible()
        assert page.locator('#joystick').is_visible(), (browser_name, w, h, 'missing joystick layer')
        assert page.locator('#joystick').evaluate("(el) => getComputedStyle(el).opacity === '0'"), (browser_name, w, h, 'idle joystick not hidden')
        for selector in ('#hud', '#pause-btn'):
            bounds_ok(page, selector, w, h)
        # Verify floating origins at different positions on both desktop and mobile.
        # Browser pointer/touch emulation is not physical iOS/Android evidence.
        for x, y in ((w * .72, h * .60), (w * .30, h * .72)):
            page.mouse.move(x, y)
            page.mouse.down()
            assert page.locator('#joystick').evaluate("(el) => el.classList.contains('active')"), 'joystick did not activate'
            stick = page.locator('#joystick').bounding_box()
            assert abs(stick['x'] + stick['width'] / 2 - x) < 2, 'joystick origin x not floating'
            assert abs(stick['y'] + stick['height'] / 2 - y) < 2, 'joystick origin y not floating'
            page.mouse.move(x + min(22, stick['width'] * .20), y, steps=3)
            assert 'translate' in page.locator('#knob').get_attribute('style'), 'joystick drag did not update knob'
            page.mouse.up()
            assert not page.locator('#joystick').evaluate("(el) => el.classList.contains('active')"), 'joystick did not hide'
            assert 'translate(0px, 0px)' in page.locator('#knob').get_attribute('style'), 'joystick did not release'
        if touch_enabled:
            page.touchscreen.tap(w * .72, h * .65)
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(200)
        page.keyboard.up('ArrowRight')
        # Keyboard-only pause/resume path is independent of tapping pause button.
        page.keyboard.press('Escape')
        assert page.get_by_text('PAUSED', exact=True).count() == 1
        page.keyboard.press('Escape')
        assert page.locator('#overlay').is_hidden(), (browser_name, w, h, 'Escape resume failed')
        page.locator('#pause-btn').click()
        assert page.get_by_text('PAUSED', exact=True).count() == 1
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="resume"]').click()
        assert page.locator('#overlay').is_hidden()
        page.locator('#pause-btn').click()
        page.locator('[data-action="home"]').click()
        page.locator('[data-action="wardrobe"]').click()
        assert page.locator('.skin-card').count() == 8
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="home"]').click()
        assert not errors, (browser_name, w, h, errors)
        print('PASS', browser_name, f'{w}x{h}', 'responsive, touch emulation (mobile only), desktop keyboard/focus, settings, pause, wardrobe')
        page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--served', action='store_true', help='Normal HTTP origin; requires running dev server')
    parser.add_argument('--embedded', action='store_true', help='Sandbox fallback; not HTTP proof')
    parser.add_argument('--browsers', nargs='+', default=['chromium', 'webkit'])
    args = parser.parse_args()
    assert args.served != args.embedded, 'Choose exactly one of --served or --embedded'
    # npm test currently covers tests/*.test.js only; include QA-owned nested Node regressions here.
    subprocess.run(['node', '--test', 'tests/qa/regression.test.js'], cwd=ROOT, check=True)
    html, module = (None, None) if args.served else modules_and_html()
    with sync_playwright() as p:
        for name in args.browsers:
            # Isolate Canvas/GPU state between browser viewports to prevent WebKit crashes.
            for size in SIZES:
                kwargs = {}
                if name == 'chromium' and args.embedded and os.environ.get('ARCANA_CHROMIUM_PATH'):
                    kwargs = {'executable_path': os.environ['ARCANA_CHROMIUM_PATH'], 'args': ['--no-sandbox']}
                browser = getattr(p, name).launch(headless=True, **kwargs)
                try:
                    scenario(browser, name, 'served' if args.served else 'embedded', size, html, module)
                finally:
                    browser.close()
    print('QA COMPLETE:', len(args.browsers) * len(SIZES), 'browser/viewport combinations')


if __name__ == '__main__':
    main()
