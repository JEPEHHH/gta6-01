# JEPEHHH/gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JEPEHHH/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JEPEHHH/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6 that runs in a desktop browser from its own files: a sun-lit city you walk and drive through, traffic and pedestrians, cars you can steal, a wanted level with police that respond, six story jobs, combat, a HUD with a minimap, a start screen and saved progress. Built with plain canvas 2D and ES modules, no build step, no network.

SOL VERDE is a coastal grid of eight by six blocks — downtown towers, shophouses, parks, parking lots and a marina in the south-east corner — generated from one seed, so every street, car, face and sound here is made by the game itself. There is no borrowed asset, no image file, no font download: the city, the cars, the people, the light and the noise are all drawn and synthesised at runtime.

## What is in it

- **The city.** A road grid with lane paint, zebra crossings, kerbs, signals, lamps, sidewalk furniture, roof vents, stair heads, billboards and shop signs. A slow clock runs from afternoon into dusk, and the whole frame tints with it: lamps, headlamps and police light bars glow after dark.
- **Driving.** Six car types with their own mass of feel — grip, turn rate and top speed. Stamina-free throttle and brake, a handbrake that lets the tail slide, tyre marks, body damage, smoke, fire and an explosion that costs you health.
- **Stealing cars.** Press E beside any car to take it, AI driver or not; carjacking is a crime a witness calls in. Parked cars in the lots are fair game too.
- **Traffic and crowds.** AI cars follow the lane grid junction to junction, brake behind each other and for you on foot. Pedestrians walk the block loop, get out of the way of a speeding car, flee gunfire, and leave a mark the street keeps a while.
- **Wanted level and police.** Crimes add heat; every 100 heat is a star up to five. Patrol cars spawn out of sight, chase, ram and shoot, a helicopter joins at four stars, and the heat only cools once nothing has eyes on you. Caught on foot and still: busted.
- **Six story jobs** from three contacts — Riva, Mira and Tavo — that chain fetch, deliver, steal, wreck and shake-the-police steps, each with a marked objective, a line of dialogue and cash on completion.
- **Combat.** Fists, pistol, SMG and shotgun, each with its own rate, spread and pellet count; drive-bys from the car window; armour, health and cash pickups.
- **The respray.** TALLER SOL sprays the car and clears the stars for $300 — the one way out of a chase that does not end at the morgue.
- **HUD.** Health and armour, cash, clock, five wanted stars, the objective line, contact dialogue, a live minimap with blips and a clamped objective marker, a speedometer while driving, toasts and the control legend.
- **Sound.** Engine, siren, gunfire, impacts, cash and job stings, synthesised with WebAudio on the first input — nothing downloaded, and silence if the browser refuses.
- **Start screen and save.** A title screen over a live junction, pause, wasted, busted, and a run saved to localStorage with F and restored with L.

Controls: WASD / arrows to move, mouse to aim and click to shoot, E to enter or leave a car, Shift to sprint, Esc to pause, F5 to save.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and play. `main.ts` is the entry the grader runs: it copies `game/` and `screenshots/` to the output folder and writes `dossier.json` with `buildDossier`.

The screenshots come from the game's own staged scenes, one per URL, so anyone can reproduce them:

```sh
node serve.ts &
chrome --headless=new --window-size=1280,720 --screenshot=1-start.png "http://127.0.0.1:8080/index.html?shot=start&seed=1"
# ?shot=city, ?shot=chase, ?shot=mission for the other three
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
