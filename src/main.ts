import { Engine } from "@babylonjs/core/Engines/engine";
import { createScene } from "./scene";
import { setupFpsController } from "./fps-controller";
import { setupShooting } from "./shooting";
import { EnemyManager } from "./enemy";
import { RoundManager } from "./round-system";
import { PlayerHealth } from "./player";
import { HUD } from "./hud";
import { gameEvents } from "./events";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const { scene, mapData } = createScene(engine);
setupFpsController(scene, canvas, mapData.playerStart, mapData.walls);

const hud = new HUD();
const _playerHealth = new PlayerHealth();
const enemyManager = new EnemyManager(scene);
enemyManager.setWalls(mapData.walls);
enemyManager.setSpawnPoints(mapData.spawnPoints);

const roundManager = new RoundManager(enemyManager);

setupShooting(scene, enemyManager, hud);

// Release pointer lock on player death
gameEvents.on("playerDied", () => {
  document.exitPointerLock();
});

// Start the first round after a short delay using delta-time tracking
let startDelay = 0;
let gameStarted = false;
const START_DELAY_MS = 2000;

engine.runRenderLoop(() => {
  const dt = engine.getDeltaTime();

  if (!gameStarted) {
    startDelay += dt;
    if (startDelay >= START_DELAY_MS) {
      gameStarted = true;
      roundManager.start();
    }
  } else {
    roundManager.update(dt);
  }

  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});
