import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { initDb } from './models';
import tireRoutes from './routes/tires';
import stockRoutes from './routes/stock';

// Node's Single Executable Application API (present only in the packaged .exe).
type SeaApi = { isSea(): boolean; getAsset(key: string, encoding?: string): ArrayBuffer | string };
let sea: SeaApi | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sea = require('node:sea') as SeaApi;
} catch {
  sea = undefined;
}
const isSea = Boolean(sea?.isSea?.());

const app = express();
const PORT = Number(process.env.TIRE_WAREHOUSE_PORT) || 3000;
const isPackaged = isSea || Boolean((process as unknown as { pkg?: unknown }).pkg);
const publicDir = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());

app.use('/api/tires', tireRoutes);
app.use('/api/stock', stockRoutes);

const notFoundApi = (res: express.Response) =>
  res.status(404).json({ success: false, message: '接口不存在' });

if (isSea && sea) {
  // Packaged mode: the whole frontend build is embedded in the SEA blob as a
  // single JSON map of { "/path": base64 }. Serve it from memory; unknown
  // non-API routes fall back to index.html so the SPA can handle routing.
  const files: Record<string, string> = JSON.parse(sea.getAsset('frontend.json', 'utf8') as string);
  const buffers = new Map<string, Buffer>();
  for (const [key, value] of Object.entries(files)) {
    buffers.set(key, Buffer.from(value, 'base64'));
  }
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return notFoundApi(res);
    let key = req.path === '/' ? '/index.html' : req.path;
    let buf = buffers.get(key);
    if (!buf) {
      key = '/index.html';
      buf = buffers.get(key);
    }
    if (!buf) return res.status(404).send('页面不存在');
    res.type(path.extname(key) || '.html').send(buf);
  });
} else if (fs.existsSync(publicDir)) {
  // Compiled (non-packaged) mode: serve the frontend bundled beside the server.
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return notFoundApi(res);
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

initDb().then(() => {
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`服务已启动：${url}`);
    if (isPackaged) {
      console.log('正在打开浏览器…（保持此窗口开启，关闭窗口即退出程序）');
      const cmd = process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`;
      exec(cmd);
    }
  });
});
