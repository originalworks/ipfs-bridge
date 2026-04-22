import * as esbuild from 'esbuild';
import esbuildPluginTsc from 'esbuild-plugin-tsc';

await esbuild.build({
  entryPoints: ['src/lambdaEntrypoint.ts'],
  bundle: true,
  sourcemap: true,
  minify: false,
  platform: 'node',
  target: 'node22',
  outdir: 'infrastructure/out/ipfs-bridge',
  loader: {
    // ensures .node binaries are copied to ./dist
    '.node': 'copy',
  },
  plugins: [esbuildPluginTsc()],
  external: [
    '@aws-sdk/*',
    '@nestjs/microservices',
    '@nestjs/websockets',
    'class-transformer/storage',
    'app-root-path',
  ],
});
