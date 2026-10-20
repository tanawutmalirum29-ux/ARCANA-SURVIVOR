"""Browser QA for ARCANA SURVIVOR.
--served: actual HTTP origin (CI); --embedded: sandbox-only injected modules.
Neither test mode is a substitute for real phone hardware QA.
"""
import argparse
import os
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
    render = data_module((ROOT / 'src/render.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './storage.js'", f"from '{storage}'"))
    main = data_module((ROOT / 'src/main.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './render.js'", f"from '{render}'").replace("from './storage.js'", f"from '{storage}'"))
    html = (ROOT / 'index.html').read_text().replace('<link rel="stylesheet" href="./src/styles.css" />', '<style>' + (ROOT / 'src/styles.css').read_text() + '</style>').replace('<script type="module" src="./src/main.js"></script>', '')
    return html, main


def bounds_ok(page, selector, w, h):
    box = page.locator(selector).bounding_box()
    assert box, f'missing bounds for {selector}'
    assert box['x'] >= -1 and box['y'] >= -1 and box['x'] + box['width'] <= w + 1 and box['y'] + box['height'] <= h + 1, (selector, w, h, box)


def scenario(browser, browser_name, mode, html=None, main=None):
    for w, h in SIZES:
        page = browser.new_page(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=True, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        if mode == 'served':
            page.goto(os.environ.get('ARCANA_QA_URL', 'http://127.0.0.1:4173'), wait_until='networkidle')
        else:
            page.set_content(html)
            page.add_script_tag(type='module', content=f'import "{main}"')
        page.locator('[data-action="start"]').wait_for()
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="settings"]').click()
        page.locator('[data-action="vfx"]').click()
        assert page.get_by_text('LOW', exact=True).count() == 1
        page.locator('[data-action="motion"]').click()
        assert page.get_by_text('ON', exact=True).count() == 1
        page.locator('[data-action="back"]').click()
        page.locator('[data-action="start"]').click()
        assert page.locator('#overlay').is_hidden()
        assert page.locator('#hud').is_visible()
        assert page.locator('#joystick').is_visible(), (browser_name, w, h, 'joystick invisible')
        for selector in ('#hud', '#pause-btn', '#joystick'):
            bounds_ok(page, selector, w, h)
        # Actual pointer events + pointer capture. This is emulation, not physical touch hardware.
        stick = page.locator('#joystick').bounding_box()
        x, y = stick['x'] + stick['width'] / 2, stick['y'] + stick['height'] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + min(22, stick['width'] * .20), y, steps=3)
        assert 'translate' in page.locator('#knob').get_attribute('style'), 'joystick drag did not update knob'
        page.mouse.up()
        assert 'translate(0px, 0px)' in page.locator('#knob').get_attribute('style'), 'joystick did not release'
        page.touchscreen.tap(x, y)
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(200)
        page.keyboard.up('ArrowRight')
        page.locator('#pause-btn').click()
        assert page.get_by_text('PAUSED', exact=True).count() == 1
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="resume"]').click()
        assert page.locator('#overlay').is_hidden()
        page.locator('#pause-btn').click()
        page.locator('[data-action="home"]').click()
        page.locator('[data-action="wardrobe"]').click()
        assert page.locator('.skin-card').count() == 3
        bounds_ok(page, '.main-card', w, h)
        page.locator('[data-action="home"]').click()
        assert not errors, (browser_name, w, h, errors)
        print('PASS', browser_name, f'{w}x{h}', 'responsive, simulated touch, joystick, keyboard, settings, pause, wardrobe')
        page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--served', action='store_true', help='Normal HTTP origin; requires running dev server')
    parser.add_argument('--embedded', action='store_true', help='Sandbox fallback; not HTTP proof')
    parser.add_argument('--browsers', nargs='+', default=['chromium', 'webkit'])
    args = parser.parse_args()
    assert args.served != args.embedded, 'Choose exactly one of --served or --embedded'
    html, module = (None, None) if args.served else modules_and_html()
    with sync_playwright() as p:
        for name in args.browsers:
            kwargs = {}
            if name == 'chromium' and args.embedded and os.environ.get('ARCANA_CHROMIUM_PATH'):
                kwargs = {'executable_path': os.environ['ARCANA_CHROMIUM_PATH'], 'args': ['--no-sandbox']}
            browser = getattr(p, name).launch(headless=True, **kwargs)
            try:
                scenario(browser, name, 'served' if args.served else 'embedded', html, module)
            finally:
                browser.close()
    print('QA COMPLETE:', len(args.browsers) * len(SIZES), 'browser/viewport combinations')


if __name__ == '__main__':
    main()
