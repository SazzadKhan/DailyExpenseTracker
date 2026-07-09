// tests/run-smoke.mjs
// Headless runner for tests/smoke.html — lets agents and CI verify changes
// without a human opening a browser.
//
//   node tests/run-smoke.mjs
//
// The repo itself has no package.json (rule: no build step, no npm deps).
// Playwright is installed on first run into a cache dir OUTSIDE the repo
// (os.tmpdir()/xpense-smoke) and reused afterwards. If a dev server is
// already listening on port 8000 it is reused; otherwise one is started
// and stopped automatically. Exits 0 when all tests pass, 1 otherwise.

import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname
    .replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CACHE_DIR = path.join(os.tmpdir(), 'xpense-smoke');
const PORT = 8000;
const URL_UNDER_TEST = `http://127.0.0.1:${PORT}/tests/smoke.html`;
const IS_WIN = process.platform === 'win32';

function log(msg) { console.log(`[smoke] ${msg}`); }

async function ensurePlaywright() {
    const require = createRequire(path.join(CACHE_DIR, 'noop.js'));
    try {
        return require(path.join(CACHE_DIR, 'node_modules', 'playwright'));
    } catch (_) {
        log(`installing playwright into ${CACHE_DIR} (first run only)…`);
        execSync(`npm install --prefix "${CACHE_DIR}" playwright`, {
            stdio: 'inherit', shell: IS_WIN
        });
        const pw = require(path.join(CACHE_DIR, 'node_modules', 'playwright'));
        try {
            // Ensures the chromium binary exists (no-op if already cached).
            execSync(`npx --yes --prefix "${CACHE_DIR}" playwright install chromium`, {
                stdio: 'inherit', shell: IS_WIN
            });
        } catch (_) { /* fall through — launch() below reports clearly */ }
        return pw;
    }
}

async function serverAlreadyUp() {
    try {
        const res = await fetch(URL_UNDER_TEST, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch (_) {
        return false;
    }
}

function startServer() {
    log(`starting http-server on :${PORT}…`);
    const cmd = `npx --yes http-server . -p ${PORT} -c-1 --silent`;
    const proc = IS_WIN
        ? spawn(cmd, { cwd: REPO_ROOT, shell: true, stdio: 'ignore' })
        : spawn('npx', ['--yes', 'http-server', '.', '-p', String(PORT), '-c-1', '--silent'], {
            cwd: REPO_ROOT, stdio: 'ignore', detached: true
        });
    return proc;
}

async function waitForServer(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await serverAlreadyUp()) return;
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`dev server did not come up on :${PORT} within ${timeoutMs}ms`);
}

const reuseServer = await serverAlreadyUp();
let serverProc = null;
if (reuseServer) {
    log(`reusing server already listening on :${PORT}`);
} else {
    serverProc = startServer();
    await waitForServer();
}

const { chromium } = await ensurePlaywright();
const browser = await chromium.launch({ args: ['--no-sandbox'] });
let exitCode = 1;
try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(String(err)));

    await page.goto(URL_UNDER_TEST, { waitUntil: 'load' });
    await page.waitForSelector('body[data-smoke-done="1"]', { timeout: 15000 });
    const results = await page.evaluate(() => window.__SMOKE_RESULTS__);

    if (!results) throw new Error('page finished but __SMOKE_RESULTS__ is missing');
    for (const f of results.failures) {
        console.error(`  ✗ ${f.name}\n    ${f.err.replace(/\n/g, '\n    ')}`);
    }
    if (pageErrors.length) {
        console.error(`  page errors: ${pageErrors.join(' | ')}`);
    }
    const ok = results.failed === 0 && pageErrors.length === 0;
    log(`${results.passed}/${results.total} passed${results.failed ? `, ${results.failed} FAILED` : ''}`);
    exitCode = ok ? 0 : 1;
} catch (err) {
    console.error(`[smoke] runner error: ${err.message || err}`);
} finally {
    await browser.close();
    if (serverProc) {
        try {
            if (IS_WIN) execSync(`taskkill /pid ${serverProc.pid} /T /F`, { stdio: 'ignore' });
            else process.kill(-serverProc.pid);
        } catch (_) { /* best-effort */ }
    }
}
process.exit(exitCode);
