// gta6-01 entry glue (Node 22, standard library only).
//
// SOL VERDE is a plain static browser game: game/index.html plus its ES modules under game/src/,
// drawn on one 1280x720 canvas with the Canvas 2D API. Nothing is fetched at runtime — no CDN, no
// font, no image, no JSON — so the entry runs from its own files on a machine with no network.
//
// What this program does, and nothing more:
//   1. copies game/ to <out>/game/ (the playable build the grader serves),
//   2. copies screenshots/ to <out>/screenshots/ (the four screens the judge looks at),
//   3. writes <out>/dossier.json with the vendored buildDossier from vendor/makefun-game.ts.
//
// The dossier is a pure function of the files on disk: no clock, no randomness and no network read
// reaches it, so the same tree always yields the same dossier bytes. The caps passed to
// buildDossier are the scorer's own (reference/gate.json): they do not shape the game, they refuse
// an entry the scorer would refuse — more than 4 screenshots or one over 256 KiB, more than 993
// files under game/, 48 MiB of game files in all, a game path over 1000 bytes, or dossier text
// over 160 KiB.
//
// Run it locally with MAKEFUN_OUTPUT_DIR standing in for /output:
//   rm -rf out && mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game for a human to play with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// The game is the entry: copy it whole, directory structure and all.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// The screens, when this checkout has them (a source tree without them still builds).
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

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
