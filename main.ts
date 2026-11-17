// The gta6-01 entry program (Node 22, the standard library only, no build step): Salt Harbor is
// this repository's game/ folder, plain static files a desktop browser opens offline — one HTML
// page and its ES modules, no library, no font, no image, no network request. This program hands
// it in: it copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080 and press Enter.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   rm -rf out && mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, from the kit's gate: only text_max_bytes shapes the bytes, and the rest
// refuse an entry the scorer would refuse — more than four screenshots or any over 256 KiB, a
// game/ over 993 files and directories or 48 MiB, or any path under it over 1,000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`handed in ${out}: game/, screenshots/ and dossier.json`);
