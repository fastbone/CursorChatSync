const esbuild = require('esbuild');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: [
    'vscode', // vscode is provided by the extension host
    'better-sqlite3' // Native module, must be external
  ],
  format: 'cjs',
  platform: 'node',
  target: 'node14',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
  resolveExtensions: ['.ts', '.js'],
  tsconfig: './tsconfig.json',
}).catch(() => process.exit(1));
