// One-shot build: bundles the frontend + backend into a single Windows .exe
// under ./release, using Node's built-in Single Executable Application (SEA)
// support. This reuses the Node runtime you already have installed and only
// needs npm packages (esbuild + postject) — it does NOT download anything from
// GitHub, so it works on networks where github.com is blocked/throttled.
//
// Run with:  npm run build:exe
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(root, 'backend', 'build');
const releaseDir = path.join(root, 'release');
const bundlePath = path.join(buildDir, 'bundle.cjs');
const wasmOut = path.join(buildDir, 'sql-wasm.wasm');
const frontendJson = path.join(buildDir, 'frontend.json');
const seaConfigPath = path.join(buildDir, 'sea-config.json');
const blobPath = path.join(buildDir, 'sea-prep.blob');
const exePath = path.join(releaseDir, 'tire-warehouse.exe');
// Node SEA sentinel fuse (fixed constant expected by postject).
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const run = (cmd, cwd) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: cwd || root, stdio: 'inherit' });
};

// Recursively collect every file in a directory as { "/web/path": base64 }.
const collectFiles = (dir, base = dir, out = {}) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, base, out);
    } else {
      const rel = '/' + path.relative(base, full).split(path.sep).join('/');
      out[rel] = fs.readFileSync(full).toString('base64');
    }
  }
  return out;
};

fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(releaseDir, { recursive: true });

// 1. Build the frontend static bundle.
run('npm run build', path.join(root, 'frontend'));

// 2. Embed the whole frontend build as one JSON asset for the SEA blob.
console.log('\n> 打包前端静态文件为 frontend.json …');
const files = collectFiles(path.join(root, 'frontend', 'dist'));
fs.writeFileSync(frontendJson, JSON.stringify(files));
console.log(`  共 ${Object.keys(files).length} 个文件`);

// 3. Copy the sql.js wasm so it can be embedded as a SEA asset.
fs.copyFileSync(
  path.join(root, 'backend', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  wasmOut,
);

// 4. Bundle the backend (TypeScript + all node_modules) into a single CJS file.
console.log('\n> 使用 esbuild 打包后端 …');
const { build } = await import('esbuild');
await build({
  entryPoints: [path.join(root, 'backend', 'src', 'index.ts')],
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  absWorkingDir: path.join(root, 'backend'),
  // node:sea is a builtin resolved at runtime inside the exe.
  external: ['node:sea'],
  logLevel: 'info',
});

// 5. Generate the SEA blob from the bundle + embedded assets.
const seaConfig = {
  main: bundlePath,
  output: blobPath,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets: {
    'sql-wasm.wasm': wasmOut,
    'frontend.json': frontendJson,
  },
};
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
console.log('\n> 生成 SEA blob …');
run(`node --experimental-sea-config "${seaConfigPath}"`);

// 6. Copy the local Node runtime and inject the blob into it.
console.log('\n> 复制 Node 运行时并注入应用 …');
fs.copyFileSync(process.execPath, exePath);
run(`npx --yes postject "${exePath}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse ${FUSE}`);

console.log('\n✅ 打包完成：release/tire-warehouse.exe');
console.log('   把这个 exe 拷到目标电脑双击即可运行；数据会保存在同目录的 data.db。');
