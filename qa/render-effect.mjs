import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pageEffect } from '../page-effect.js';
const profile = await mkdtemp(join(tmpdir(), 'fader-visual-'));
const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const guard = setTimeout(() => { browser.kill(); socket?.close(); process.exitCode = 1; }, 20000);
let endpoint;
for (let i = 0; i < 80; i++) {
  try { endpoint = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; }
  catch { await new Promise(resolve => setTimeout(resolve, 100)); }
}
if (!endpoint) { clearTimeout(guard); browser.kill(); throw new Error('Chrome debugger did not start'); }
socket = new WebSocket(`ws://127.0.0.1:${endpoint[0]}${endpoint[1]}`);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0; const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data), handler = pending.get(message.id);
  if (handler) { pending.delete(message.id); message.error ? handler.reject(message.error) : handler.resolve(message.result); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await mkdir('qa/screenshots', { recursive: true });
  for (const direct of [false, true]) {
    await evaluate(`window.clock = 1000; window.nextFrame = null; performance.now = () => window.clock; window.requestAnimationFrame = fn => { window.nextFrame = fn; return 1; }; window.cancelAnimationFrame = () => {}; window.playing = (${pageEffect.toString()})(${direct}, location.href); true`);
    for (const elapsed of [350, 950, 1600]) {
      await evaluate(`window.clock = ${1000 + elapsed}; window.nextFrame(window.clock); true`);
      const screenshot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      await writeFile(`qa/screenshots/${direct ? 'light' : 'dark'}-${elapsed}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    await evaluate('window.clock = 3100; window.nextFrame(window.clock); true');
  }
  console.log('Rendered 6 frames in Chrome without JavaScript errors.');
} finally { clearTimeout(guard); socket.close(); browser.kill(); }
