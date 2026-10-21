"""Browser QA for ARCANA SURVIVOR.
--served: actual HTTP origin (CI); --embedded: sandbox-only injected modules.
Neither test mode is a substitute for real phone hardware QA.
"""
import argparse
import json
import os
import subprocess
import sys
from base64 import b64encode
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(320, 568), (390, 844), (768, 1024), (844, 390), (1440, 900)]


def modules_and_html():
    def data_module(source):
        return 'data:text/javascript;base64,' + b64encode(source.encode()).decode()
    engine = data_module((ROOT / 'src/engine.js').read_text())
    storage = data_module((ROOT / 'src/storage.js').read_text())
    lobby_music = data_module((ROOT / 'src/lobbyMusic.js').read_text())
    audio = data_module((ROOT / 'src/audio.js').read_text().replace("from './lobbyMusic.js'", f"from '{lobby_music}'"))
    render = data_module((ROOT / 'src/render.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './storage.js'", f"from '{storage}'"))
    main = data_module((ROOT / 'src/main.js').read_text().replace("from './engine.js'", f"from '{engine}'").replace("from './render.js'", f"from '{render}'").replace("from './storage.js'", f"from '{storage}'").replace("from './audio.js'", f"from '{audio}'"))
    html = (ROOT / 'index.html').read_text().replace('<link rel="stylesheet" href="./src/styles.css" />', '<style>' + (ROOT / 'src/styles.css').read_text() + '</style>').replace('<script type="module" src="./src/main.js"></script>', '')
    return html, main


def report_layout_failure(page, selector, w, h, browser_name, reason, lifecycle):
    """Capture failure-time evidence, without changing app state or retrying assertions."""
    record = {'browser': browser_name, 'viewport': [w, h], 'selector': selector,
              'reason': str(reason), 'lifecycle': lifecycle[-15:]}
    try:
        record['dom'] = page.evaluate("""selector => {
          const el=document.querySelector(selector), hud=document.querySelector('#hud'),
            overlay=document.querySelector('#overlay'), app=document.querySelector('#app');
          const view=window.visualViewport;
          const rect=target => {
            if(!target)return null;
            const r=target.getBoundingClientRect();
            return {x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,
              right:r.right,bottom:r.bottom};
          };
          const style=target => {
            if(!target)return null;
            const s=getComputedStyle(target);
            return {display:s.display,visibility:s.visibility,opacity:s.opacity,
              position:s.position,overflow:s.overflow,pointerEvents:s.pointerEvents};
          };
          return {
            readyState:document.readyState, hidden:document.hidden,
            hasFocus:document.hasFocus(), url:location.pathname,
            innerWidth,innerHeight, devicePixelRatio,
            visualViewport:view?{width:view.width,height:view.height,
              scale:view.scale,offsetTop:view.offsetTop,offsetLeft:view.offsetLeft}:null,
            selected:{exists:!!el,connected:el?.isConnected??false,
              classes:el?.className??null,rect:rect(el),style:style(el)},
            hud:{exists:!!hud,connected:hud?.isConnected??false,
              classes:hud?.className??null,rect:rect(hud),style:style(hud),
              hp:document.querySelector('#hp-text')?.textContent??null,
              clock:document.querySelector('#clock')?.textContent??null},
            overlay:{classes:overlay?.className??null,
              rect:rect(overlay),style:style(overlay),
              title:overlay?.querySelector('h2')?.textContent??null,
              text:overlay?.textContent?.trim().slice(0,160)??null},
            app:{rect:rect(app),style:style(app)},
            body:{classes:document.body?.className??null,
              style:style(document.body)},
            frameTime:performance.now()
          };
        }""", selector)
    except Exception as exc:
        record['dom_error'] = repr(exc)
    print('QA_LAYOUT_FAILURE ' + json.dumps(record, ensure_ascii=False,
         sort_keys=True), flush=True)
    try:
        dest = f'/tmp/arcana-qa-layout-{browser_name}-{w}x{h}.png'
        page.screenshot(path=dest, timeout=5000)
        print('QA_LAYOUT_FAILURE_SCREENSHOT_LOCAL ' + dest, flush=True)
    except Exception as exc:
        print('QA_LAYOUT_FAILURE_SCREENSHOT_FAILED ' + repr(exc), flush=True)


def bounds_ok(page, selector, w, h, browser_name='unknown', lifecycle=None):
    lifecycle = lifecycle if lifecycle is not None else []
    try:
        box = page.locator(selector).bounding_box()
    except Exception as exc:
        report_layout_failure(page, selector, w, h, browser_name,
                              'bounding_box raised: ' + repr(exc), lifecycle)
        raise
    if not box:
        report_layout_failure(page, selector, w, h, browser_name,
                              'bounding_box returned None', lifecycle)
        raise AssertionError(f'missing bounds for {selector}')
    if not (box['x'] >= -1 and box['y'] >= -1 and
            box['x'] + box['width'] <= w + 1 and
            box['y'] + box['height'] <= h + 1):
        report_layout_failure(page, selector, w, h, browser_name,
                              'out-of-viewport bounds: ' + repr(box), lifecycle)
        raise AssertionError((selector, w, h, box))


def report_click_obstruction(page, selector, browser_name, width, height):
    """Emit hit-test/overlay evidence on an actual Playwright timeout. Never force or retry clicks."""
    try:
        snapshot = page.evaluate("""selector => {
            const target = document.querySelector(selector);
            if (!target) return {found: false, selector};
            const b = target.getBoundingClientRect();
            const x = b.left + b.width / 2, y = b.top + b.height / 2;
            const visual = window.visualViewport;
            const nodes = document.elementsFromPoint(x, y).slice(0, 10).map(el => {
              const st = getComputedStyle(el);
              return {tag: el.tagName, id: el.id, cls: String(el.className).slice(0,120),
                action: el.dataset?.action || null, pointerEvents: st.pointerEvents,
                zIndex: st.zIndex, position: st.position, opacity: st.opacity};
            });
            const cs = getComputedStyle(target);
            return {found: true, selector, targetAction: target.dataset.action,
              center: {x, y}, bounds: {x:b.x,y:b.y,width:b.width,height:b.height},
              visible: b.width>0 && b.height>0, disabled: target.disabled,
              pointerEvents: cs.pointerEvents, activeAction: document.activeElement?.dataset?.action||null,
              scroll: {x:window.scrollX,y:window.scrollY,cardY:target.closest('.main-card')?.scrollTop||0},
              viewport: {innerWidth,innerHeight,visualOffsetX:visual?.offsetLeft,
                visualOffsetY:visual?.offsetTop,visualScale:visual?.scale},
              centerHitAction: document.elementFromPoint(x,y)?.dataset?.action||null,
              elementsAtClickCenter: nodes};
          }""", selector)
        print('QA_CLICK_OBSTRUCTION ' + json.dumps(
            {'browser': browser_name, 'size': [width, height], **snapshot},
            ensure_ascii=False, sort_keys=True), flush=True)
    except Exception as exc:
        print('QA_CLICK_OBSTRUCTION_DIAGNOSTIC_FAILED ' + repr(exc), flush=True)
    # Screenshot is local evidence only. Its absence from Actions artifacts is not hidden.
    try:
        dest = f'/tmp/arcana-qa-back-{browser_name}-{width}x{height}.png'
        page.screenshot(path=dest, timeout=5000)
        print('QA_CLICK_OBSTRUCTION_SCREENSHOT_LOCAL ' + dest, flush=True)
    except Exception as exc:
        print('QA_CLICK_OBSTRUCTION_SCREENSHOT_FAILED ' + repr(exc), flush=True)


def report_lifecycle_click_failure(page, selector, browser_name, width, height,
                                   error, lifecycle, errors):
    """Record browser/page termination evidence without suppressing an original click error."""
    record = {
        'browser': browser_name, 'viewport': [width, height],
        'selector': selector, 'error_type': type(error).__name__,
        'error': str(error)[:2400], 'lifecycle': lifecycle[-25:],
        'pageerrors_and_console': errors[-12:],
    }
    try:
        record['page_closed'] = page.is_closed()
        browser = page.context.browser
        record['browser_connected'] = browser.is_connected() if browser else None
    except Exception as exc:
        record['connection_probe_error'] = repr(exc)
    try:
        record['dom'] = page.evaluate("""selector => {
          const target=document.querySelector(selector),
            overlay=document.querySelector('#overlay'),
            hud=document.querySelector('#hud');
          const rect=el => {
            if(!el)return null;
            const r=el.getBoundingClientRect();
            return {x:r.x,y:r.y,width:r.width,height:r.height};
          };
          const styles=el => {
            if(!el)return null;
            const s=getComputedStyle(el);
            return {display:s.display,visibility:s.visibility,
              pointerEvents:s.pointerEvents,opacity:s.opacity};
          };
          return {
            readyState:document.readyState,hidden:document.hidden,
            hasFocus:document.hasFocus(),frameTime:performance.now(),
            target:{exists:!!target,connected:target?.isConnected??false,
              action:target?.dataset?.action??null,rect:rect(target),
              style:styles(target)},
            overlay:{classes:overlay?.className??null,
              heading:overlay?.querySelector('h2')?.textContent??null,
              rect:rect(overlay),style:styles(overlay)},
            hud:{classes:hud?.className??null,rect:rect(hud),style:styles(hud)},
            viewport:{innerWidth,innerHeight},
          };
        }""", selector)
    except Exception as exc:
        record['dom_error'] = repr(exc)
    print('QA_LIFECYCLE_CLICK_FAILURE ' + json.dumps(record,
          ensure_ascii=False, sort_keys=True), flush=True)
    # Reuse the CEO-owned layout-failure screenshot glob only if a live page
    # still permits it. TargetClosed normally makes this unavailable.
    try:
        action = selector.replace('#','').replace(' ','').replace('[data-action="','').replace('"]','')
        dest = f'/tmp/arcana-qa-layout-lifecycle-{browser_name}-{width}x{height}-{action}.png'
        page.screenshot(path=dest, timeout=2500)
        print('QA_LIFECYCLE_SCREENSHOT_LOCAL ' + dest, flush=True)
    except Exception as exc:
        print('QA_LIFECYCLE_SCREENSHOT_FAILED ' + repr(exc), flush=True)


def click_with_lifecycle_evidence(page, selector, browser_name, width, height,
                                  lifecycle, errors):
    """Ordinary Playwright click; add evidence on failure and re-raise unchanged."""
    try:
        page.locator(selector).click()
    except PlaywrightError as exc:
        report_lifecycle_click_failure(page, selector, browser_name, width,
                                       height, exc, lifecycle, errors)
        raise


def scenario(browser, browser_name, mode, size, html=None, main=None, setup_page=None, close_page=True, initial_sound_off=False):
    for w, h in [size]:
        touch_enabled = w < 1000  # 1440x900 exercises actual desktop pointer/keyboard mode.
        page = browser.new_page(viewport={'width': w, 'height': h}, has_touch=touch_enabled, is_mobile=touch_enabled, device_scale_factor=1)
        if setup_page is not None:
            setup_page(page)
        errors = []
        lifecycle = []
        page.on('crash', lambda _: lifecycle.append('PAGE_CRASH'))
        page.context.on('close', lambda _: lifecycle.append('CONTEXT_CLOSED'))
        page.on('framenavigated', lambda f: lifecycle.append('MAIN_FRAME_NAVIGATED') if f == page.main_frame else None)
        page.on('close', lambda _: lifecycle.append('PAGE_CLOSED'))
        browser.on('disconnected', lambda _: lifecycle.append('BROWSER_DISCONNECTED'))
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
        bounds_ok(page, '.main-card', w, h, browser_name, lifecycle)
        assert page.locator('[data-action="lobby-music"]').count() == 0, 'manual lobby play button remains'
        assert page.locator('[data-action="music-theme"]').count() == 0, 'lobby theme control remains'
        page.locator('[data-action="settings"]').click()
        page.locator('[data-action="vfx"]').click()
        assert page.get_by_text('LOW', exact=True).count() == 1
        page.locator('[data-action="motion"]').click()
        assert page.get_by_text('ON', exact=True).count() == 1
        # Same two normal clicks for both variants; start and end with the
        # injected SOUND OFF preference during the muted experiment.
        if initial_sound_off:
            assert page.get_by_text('SOUND OFF', exact=True).count() == 1
            page.locator('[data-action="sound"]').click()
            assert page.get_by_text('SOUND ON', exact=True).count() == 1
            page.locator('[data-action="sound"]').click()
            assert page.get_by_text('SOUND OFF', exact=True).count() == 1
        else:
            page.locator('[data-action="sound"]').click()
            assert page.get_by_text('SOUND OFF', exact=True).count() == 1
            page.locator('[data-action="sound"]').click()
            assert page.get_by_text('SOUND ON', exact=True).count() == 1
        previous_theme = page.locator('[data-action="music-settings"]').inner_text()
        click_with_lifecycle_evidence(page, '[data-action="music-settings"]',
                                      browser_name, w, h, lifecycle, errors)
        current_theme = page.locator('[data-action="music-settings"]').inner_text()
        assert previous_theme != current_theme, 'festival selection in settings did not change'
        try:
            page.locator('[data-action="back"]').click()
        except PlaywrightTimeoutError:
            report_click_obstruction(page, '[data-action="back"]', browser_name, w, h)
            raise
        assert page.locator('[data-action="lobby-music"]').count() == 0
        assert page.locator('[data-action="music-theme"]').count() == 0
        page.locator('[data-action="start"]').click()
        assert page.locator('#overlay').is_hidden()
        assert page.locator('#hud').is_visible()
        assert page.locator('#joystick').is_visible(), (browser_name, w, h, 'missing joystick layer')
        assert page.locator('#joystick').evaluate("(el) => getComputedStyle(el).opacity === '0'"), (browser_name, w, h, 'idle joystick not hidden')
        for selector in ('#hud', '#pause-btn'):
            bounds_ok(page, selector, w, h, browser_name, lifecycle)
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
        click_with_lifecycle_evidence(page, '#pause-btn', browser_name,
                                      w, h, lifecycle, errors)
        assert page.get_by_text('PAUSED', exact=True).count() == 1
        bounds_ok(page, '.main-card', w, h, browser_name, lifecycle)
        page.locator('[data-action="resume"]').click()
        assert page.locator('#overlay').is_hidden()
        click_with_lifecycle_evidence(page, '#pause-btn', browser_name,
                                      w, h, lifecycle, errors)
        page.locator('[data-action="home"]').click()
        page.locator('[data-action="wardrobe"]').click()
        assert page.locator('.skin-card').count() == 8
        bounds_ok(page, '.main-card', w, h, browser_name, lifecycle)
        page.locator('[data-action="home"]').click()
        assert not errors, (browser_name, w, h, errors)
        print('PASS', browser_name, f'{w}x{h}', 'responsive, touch emulation (mobile only), desktop keyboard/focus, settings, pause, wardrobe')
        if close_page:
            page.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--served', action='store_true', help='Normal HTTP origin; requires running dev server')
    parser.add_argument('--embedded', action='store_true', help='Sandbox fallback; not HTTP proof')
    parser.add_argument('--browsers', nargs='+', default=['chromium', 'webkit'])
    args = parser.parse_args()
    assert args.served != args.embedded, 'Choose exactly one of --served or --embedded'
    # One opt-in QA-only CI run on the authorized PR branch; NEVER on main.
    if args.served and os.environ.get('GITHUB_HEAD_REF') == 'test/qa-webkit-768-bounded-sound':
        print('QA_BOUNDED_PROBE_ONCE: 768x1024 sound A/B diagnostic', flush=True)
        subprocess.run([sys.executable, '-u', 'tests/qa/webkit_sound_ab.py'], cwd=ROOT, check=True)
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
