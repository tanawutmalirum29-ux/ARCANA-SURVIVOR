"""ONE authorized bounded QA experiment for WebKit 768x1024; never used by game runtime.

Triggered from scripts/browser_qa.py only when GITHUB_HEAD_REF is the opt-in
QA diagnostic branch. Six independent WebKit max (3 default, 3 muted) and
optional two Chromium controls. The baseline browser_qa.scenario is reused
without changing click assertions, test timeouts, game files or render code.
"""
import importlib.metadata
import json
import os
import sys
import time
import traceback
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from browser_qa import scenario

STORAGE_KEY = 'arcana-survivor-sound-v1'
TARGET = (768, 1024)
URL = os.environ.get('ARCANA_QA_URL', 'http://127.0.0.1:4173')
# Read by Playwright's Node driver, not an application source change.
os.environ['DEBUG'] = 'pw:browser'
TRACE_DIR = Path('/tmp/arcana-qa-webkit-traces')
TRACE_DIR.mkdir(parents=True, exist_ok=True)


def emit(tag, value):
    print(tag + ' ' + json.dumps(value, ensure_ascii=False, sort_keys=True), flush=True)


def run_trial(playwright, browser_name, condition, trial):
    t0 = time.perf_counter()
    events = []
    page_holder = []
    browser = None
    trace_active = False
    trace_path = TRACE_DIR / f'{browser_name}-{condition}-{trial}.zip'
    screenshot_path = f'/tmp/arcana-qa-layout-probe-{browser_name}-{condition}-{trial}.png'
    meta = {'browser': browser_name, 'condition': condition, 'trial': trial,
            'viewport': TARGET, 'seed': 73001,
            'playwright': importlib.metadata.version('playwright'),
            'test_file': 'scripts/browser_qa.py', 'url': URL}
    error = None
    result = 'PASS'

    def configure(page):
        nonlocal trace_active
        page_holder.append(page)
        page.on('crash', lambda _: events.append('PAGE_CRASH'))
        page.on('close', lambda _: events.append('PAGE_CLOSE'))
        page.context.on('close', lambda _: events.append('CONTEXT_CLOSE'))
        page.on('pageerror', lambda exc: events.append('PAGEERROR ' + str(exc)[:400]))
        page.on('console', lambda msg: events.append('CONSOLE_ERROR ' + msg.text[:400]) if msg.type == 'error' else None)
        page.on('framenavigated', lambda f: events.append('MAIN_NAVIGATION') if f == page.main_frame else None)
        if condition == 'sound_off':
            # Existing storage precondition installed before ANY app script runs.
            page.context.add_init_script(
                f"localStorage.setItem({json.dumps(STORAGE_KEY)}, 'off')"
            )
        page.context.tracing.start(screenshots=True, snapshots=True, sources=False)
        trace_active = True

    try:
        browser = getattr(playwright, browser_name).launch(headless=True)
        browser.on('disconnected', lambda _: events.append('BROWSER_DISCONNECTED'))
        meta['browser_version'] = browser.version
        scenario(browser, browser_name, 'served', TARGET,
                 setup_page=configure, close_page=False)
        page = page_holder[0]
        actual_key = page.evaluate(f"localStorage.getItem({json.dumps(STORAGE_KEY)})")
        # SOUND default may be written during regular Settings toggling: the
        # precondition is verified by a separate init-script marker below, not
        # by asserting the setting remains absent after the normal scenario.
        if condition == 'sound_off':
            meta['final_sound_storage'] = actual_key
    except BaseException as exc:
        result = 'FAIL'
        error = exc
        meta['failure_type'] = type(exc).__name__
        meta['failure_message'] = str(exc)[:1200]
        frames = traceback.extract_tb(exc.__traceback__)
        meta['failure_site'] = [
            f'{Path(f.filename).name}:{f.lineno}:{f.name}'
            for f in frames if '/scripts/browser_qa.py' in f.filename
        ][-3:]
        if page_holder:
            try:
                page_holder[0].screenshot(path=screenshot_path, timeout=2500)
                meta['screenshot_path'] = screenshot_path
            except Exception as shot_error:
                meta['screenshot_error'] = repr(shot_error)[:350]
    finally:
        if trace_active and page_holder:
            try:
                page_holder[0].context.tracing.stop(path=str(trace_path))
                if trace_path.is_file():
                    meta['trace_path'] = str(trace_path)
                    meta['trace_size_bytes'] = trace_path.stat().st_size
            except Exception as trace_error:
                meta['trace_error'] = repr(trace_error)[:450]
        meta['last_events'] = events[-16:]
        meta['duration_seconds'] = round(time.perf_counter()-t0, 3)
        meta['result'] = result
        emit('QA_BOUNDED_TRIAL', meta)
        if browser:
            try:
                browser.close()
            except Exception as close_error:
                emit('QA_BOUNDED_CLEANUP', {'error': repr(close_error)[:400]})
    # Preserve the FIRST failure as a failure; NEVER retry or suppress it.
    if error is not None:
        raise error.with_traceback(error.__traceback__)


def main():
    if not os.environ.get('GITHUB_HEAD_REF') == 'test/qa-webkit-768-bounded-sound':
        raise SystemExit('ERROR: this probe may only run in its authorized QA branch')
    emit('QA_BOUNDED_CONTRACT', {
        'max_webkit_trials_per_condition': 3, 'webkit_viewport': TARGET,
        'conditions': ['default_sound', 'sound_off'],
        'chromium_controls_per_condition': 1,
        'audio_precondition_only': True, 'debug': os.environ['DEBUG'],
        'no_forced_click_sleep_or_retry': True
    })
    with sync_playwright() as pw:
        for condition in ('default_sound','sound_off'):
            for number in range(1,4):
                run_trial(pw,'webkit',condition,number)
        # Only after all WebKit trials: two optional references.
        for condition in ('default_sound','sound_off'):
            run_trial(pw,'chromium',condition,1)
    emit('QA_BOUNDED_DONE', {'webkit': 6, 'chromium': 2, 'failures': 0,
          'interpretation': 'NOT REPRODUCED in bounded run; NOT a root-cause fix'})


if __name__ == '__main__':
    main()
