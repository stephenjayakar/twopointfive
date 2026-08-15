// A PRIVATE headless Chrome driven over the DevTools protocol — for lanes that must not touch the shared Browser pane.
//   import { Cdp } from './cdp';
//   const c = await Cdp.launch({ port: 9346 });                       // spawns Chrome --headless=new (Metal / WebGPU), its own profile under /tmp
//   await c.open('http://localhost:5252/?paused&quality=high&mute');  // navigates the one page target and waits for load
//   await c.eval('window.__ready.then(() => 1)');                     // Runtime.evaluate, awaitPromise, returnByValue
//   c.errors                                                          // console errors + uncaught exceptions + Log errors seen so far
//   await c.close();
// CLI: bun run tools/qa/cdp.ts <url> '<js expression>'  → prints the JSON value (a smoke test of the driver itself).
// Needs the sandbox OFF (it binds a loopback port and talks to another). Chrome path: CHROME=… overrides the macOS default.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export interface LaunchOpts { port?: number; width?: number; height?: number; dpr?: number; extraArgs?: string[]; verbose?: boolean; }

export class Cdp {
  errors: string[] = [];
  logs: string[] = [];
  private ws!: WebSocket; private seq = 1; private pending = new Map<number, { res: (v: any) => void; rej: (e: any) => void }>();
  private constructor(private proc: ChildProcess, private profile: string, private port: number, private verbose: boolean) {}

  static async launch(o: LaunchOpts = {}): Promise<Cdp> {
    const port = o.port ?? 9333, w = o.width ?? 1600, h = o.height ?? 900, dpr = o.dpr ?? 2;
    const profile = mkdtempSync(join(tmpdir(), 'cdp-prof-'));
    const args = [
      '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--enable-unsafe-webgpu', '--use-angle=metal', '--enable-features=Vulkan', `--window-size=${w},${h}`, `--force-device-scale-factor=${dpr}`,
      '--hide-scrollbars', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required', 'about:blank', ...(o.extraArgs ?? []),
    ];
    const proc = spawn(CHROME, args, { stdio: o.verbose ? 'inherit' : 'ignore' });
    const c = new Cdp(proc, profile, port, !!o.verbose);
    // wait for the endpoint, then attach to the first page target
    let list: any[] = [];
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); list = (await r.json()).filter((t: any) => t.type === 'page'); if (list.length) break; } catch { /* not up yet */ }
      await new Promise(r => setTimeout(r, 100));
    }
    if (!list.length) { proc.kill(); throw new Error('cdp: Chrome did not come up on :' + port); }
    await c.attach(list[0].webSocketDebuggerUrl);
    return c;
  }

  private attach(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(url);
      ws.onopen = async () => {
        try {
          await this.send('Runtime.enable'); await this.send('Page.enable'); await this.send('Log.enable');
          resolve();
        } catch (e) { reject(e); }
      };
      ws.onerror = (e) => reject(e);
      ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        if (m.id) { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); } return; }
        if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; const s = `exception: ${d.exception?.description ?? d.text}`; this.errors.push(s); if (this.verbose) console.error(s); }
        else if (m.method === 'Runtime.consoleAPICalled') {
          const s = m.params.args.map((a: any) => a.value ?? a.description ?? '').join(' ');
          if (m.params.type === 'error' || m.params.type === 'assert') { this.errors.push(`console.${m.params.type}: ${s}`); if (this.verbose) console.error('console.error:', s); }
          else { this.logs.push(s); if (this.verbose) console.log('console:', s); }
        }
        else if (m.method === 'Log.entryAdded') { const e = m.params.entry; if (e.level === 'error') { this.errors.push(`log: ${e.source} ${e.text}`); if (this.verbose) console.error('log:', e.text); } }
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.seq++;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params })); });
  }

  /** Navigate and wait for the load event (+ document.readyState complete). */
  async open(url: string, timeoutMs = 30000): Promise<void> {
    await this.send('Page.navigate', { url });
    const t0 = Date.now();
    for (;;) {
      await new Promise(r => setTimeout(r, 100));
      try { const st = await this.eval('document.readyState', { timeoutMs: 2000 }); if (st === 'complete') return; } catch { /* context swapping */ }
      if (Date.now() - t0 > timeoutMs) throw new Error('cdp: load timeout ' + url);
    }
  }

  /** Evaluate an expression in the page (promises awaited, value returned by value). Throws on a thrown / rejected result. */
  async eval<T = any>(expression: string, o: { timeoutMs?: number } = {}): Promise<T> {
    const p = this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: o.timeoutMs });
    const r = await (o.timeoutMs ? Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('cdp: eval timeout')), o.timeoutMs! + 2000))]) : p);
    if (r.exceptionDetails) throw new Error('cdp eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value as T;
  }

  async close(): Promise<void> {
    try { this.ws.close(); } catch { /* */ }
    this.proc.kill();
    await new Promise(r => setTimeout(r, 300));
    try { rmSync(this.profile, { recursive: true, force: true }); } catch { /* */ }
  }
}

// ------------------------------------------------------------ CLI smoke test
if (import.meta.main) {
  const [url, expr] = process.argv.slice(2);
  if (!url) { console.error('usage: bun run tools/qa/cdp.ts <url> [js expression]'); process.exit(2); }
  const c = await Cdp.launch({ port: Number(process.env.CDP_PORT) || 9333 });
  try {
    await c.open(url);
    const v = await c.eval(expr ?? 'navigator.gpu ? "webgpu ok" : "no webgpu"', { timeoutMs: 120000 });
    console.log(JSON.stringify(v, null, 1));
    if (c.errors.length) console.log('errors:', c.errors);
  } finally { await c.close(); }
}
