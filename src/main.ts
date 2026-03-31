import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { createScene } from "./scene";
import { setupFpsController } from "./fps-controller";
import { setupShooting } from "./shooting";
import { EnemyManager } from "./enemy";
import { RoundManager } from "./round-system";
import { PlayerHealth } from "./player";
import { HUD } from "./hud";
import { gameEvents } from "./events";
import { PowerUpManager } from "./powerup";
import { PowerUpEffectManager } from "./powerup-effects";
import { loadMap } from "./map-loader";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = createScene(engine);

async function init() {
  const mapData = await loadMap(scene, "/assets/office.glb");

  setupFpsController(scene, canvas, mapData.playerStart, mapData.walls, mapData.floors);

  const hud = new HUD();
  const _playerHealth = new PlayerHealth();
  const enemyManager = new EnemyManager(scene);
  enemyManager.setWalls(mapData.walls);
  enemyManager.setSpawnPoints(mapData.spawnPoints);

  const roundManager = new RoundManager(enemyManager);

  const effectManager = new PowerUpEffectManager();

  const powerUpManager = new PowerUpManager();
  for (const pos of mapData.powerUpSpawns) {
    powerUpManager.addPowerUp(scene, {
      type: "compilateur",
      color: new Color3(0, 1, 0),
      position: pos,
    });
  }

  setupShooting(scene, enemyManager, hud, effectManager);

  gameEvents.on("playerDied", () => {
    document.exitPointerLock();
  });

  // TODO: re-enable enemies when map work is done
  // let startDelay = 0;
  // let gameStarted = false;
  // const START_DELAY_MS = 2000;

  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime();

    // Enemies disabled — map editing mode
    // if (!gameStarted) {
    //   startDelay += dt;
    //   if (startDelay >= START_DELAY_MS) {
    //     gameStarted = true;
    //     roundManager.start();
    //   }
    // } else {
    //   roundManager.update(dt);
    // }

    const playerPos = scene.activeCamera!.position;
    powerUpManager.update(dt, playerPos);
    effectManager.update(dt);

    const compilateurRemaining = effectManager.getRemainingTime("compilateur");
    if (compilateurRemaining > 0) {
      hud.updatePowerUpTimer(compilateurRemaining);
    }

    scene.render();
  });

  window.addEventListener("resize", () => {
    engine.resize();
  });
}

init();
