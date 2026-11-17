# SALT HARBOR — gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JEPEHHH/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JEPEHHH/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6 that runs in a desktop browser from its own files: Salt Harbor is a sun-soaked port city of six by six blocks — towers downtown, shophouse rows, a residential quarter, a park, a parking lot, warehouses and a waterfront with piers and boats — that you walk and drive through, with civilian traffic and pedestrians, cars you can steal, a five-star wanted level with police cruisers and officers who respond to it, six story jobs with a race, a shootout and a final score, combat, a HUD with a health bar, money, wanted stars and a live minimap, a title screen, pause and saved progress. Built with plain canvas 2D and ES modules, no build step, no library, no assets, no network: every street, building, car, character, sound effect and engine note is drawn or synthesised at runtime.

Controls: WASD / arrows to move, mouse to aim and click to shoot, E to enter or leave a car, Shift to sprint, Esc to pause, F5 to save.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and press Enter. `main.ts` is the entry the grader runs: it copies `game/` and `screenshots/` to the output folder and writes `dossier.json` with `buildDossier`.

The game's source is `game/index.html` plus one module per job in `game/src/`: `config.js` (the numbers and colours), `random.js` (the seeded generator), `input.js`, `audio.js` (the WebAudio instruments), `city.js` (the block-by-block map), `vehicles.js` (car physics and collision), `traffic.js`, `peds.js`, `player.js`, `police.js`, `missions.js`, `combat.js`, `world.js`, `hud.js`, `render.js`, `save.js`, `shots.js` (the four screenshot scenes) and `main.js` (the loop and screens).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
