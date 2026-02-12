import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    entryPoints: ['extension_src/background.ts', 'extension_src/content.ts'],
    bundle: true,
    outdir: 'client/public/extension',
    platform: 'browser',
    target: ['es2020'],
    format: 'esm', // Manifest V3 supports ESM
    sourcemap: true,
    minify: false, // Keep it readable for now
    loader: {
        '.ts': 'ts',
        '.js': 'js'
    },
    define: {
        'process.env.NODE_ENV': '"production"'
    },
    plugins: [],
    alias: {
        // Add aliases if needed
    }
};

async function build() {
    if (isWatch) {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        console.log('Watching for extension changes...');
    } else {
        await esbuild.build(buildOptions);
        console.log('Extension built successfully!');
    }
}

build().catch(() => process.exit(1));
