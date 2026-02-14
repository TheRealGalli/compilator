import * as esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
    bundle: true,
    outdir: 'client/public/extension',
    // entryPoints removed here, defined in build() steps
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
    // 1. Build Background, Content, and Offscreen scripts (ESM)
    const extensionCtx = await esbuild.context({
        ...buildOptions,
        entryPoints: {
            background: 'extension_src/background.ts',
            content: 'extension_src/content.ts',
            offscreen: 'extension_src/offscreen.ts'
        },
        format: 'esm',
    });

    // 2. Build PDF Worker (IIFE - Standalone)
    const workerCtx = await esbuild.context({
        ...buildOptions,
        entryPoints: {
            'pdf.worker': 'node_modules/pdfjs-dist/build/pdf.worker.mjs'
        },
        format: 'iife',
        // Ensure global name doesn't conflict
    });

    // 3. Copy Tesseract Assets (Worker & Core WASM)
    const copyTesseractAssets = () => {
        const tessDist = 'node_modules/tesseract.js/dist';
        const coreDist = 'node_modules/tesseract.js-core';
        const target = 'client/public/extension';

        const filesToCopy = [
            { src: path.join(tessDist, 'worker.min.js'), dest: 'worker.min.js' },
            { src: path.join(tessDist, 'tesseract.min.js'), dest: 'tesseract.min.js' },
            // Copy ALL tesseract-core files (support for SIMD, etc.)
            ...fs.readdirSync(coreDist)
                .filter(f => f.startsWith('tesseract-core'))
                .map(f => ({ src: path.join(coreDist, f), dest: f }))
        ];

        filesToCopy.forEach(({ src, dest }) => {
            const destPath = path.join(target, dest);
            fs.copyFileSync(src, destPath);
            // console.log(`Copied ${dest}`);
        });
        console.log('Tesseract assets copied.');
    };
    copyTesseractAssets();

    // 4. Copy offscreen.html
    const copyOffscreenHtml = () => {
        fs.copyFileSync('extension_src/offscreen.html', 'client/public/extension/offscreen.html');
        console.log('Copied offscreen.html');
    };
    copyOffscreenHtml();

    if (isWatch) {
        await extensionCtx.watch();
        await workerCtx.watch();
        console.log('Watching for extension changes...');
        // Watch offscreen.html? manual reload for now is fine
    } else {
        await extensionCtx.rebuild();
        await workerCtx.rebuild();
        await extensionCtx.dispose();
        await workerCtx.dispose();
        console.log('Extension built successfully!');
    }
}

build().catch(() => process.exit(1));
