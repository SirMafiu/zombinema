import { Engine } from "@babylonjs/core/Engines/engine";
import { createScene } from "./scene";
import { setupFpsController } from "./fps-controller";
import { setupShooting } from "./shooting";
import { EnemyManager } from "./enemy";
import { RoundManager } from "./round-system";
import { PlayerHealth } from "./player";
import { HUD } from "./hud";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas, true);

const { scene, mapData } = createScene(engine);
setupFpsController(scene, canvas, mapData.playerStart, mapData.walls);

const hud = new HUD();
const playerHealth = new PlayerHealth(hud);
const enemyManager = new EnemyManager(scene);
enemyManager.setWalls(mapData.walls);
enemyManager.setSpawnPoints(mapData.spawnPoints);

const roundManager = new RoundManager(enemyManager, hud);

enemyManager.setOnPlayerDamage((amount) => {
  playerHealth.takeDamage(amount);
});

roundManager.setOnRoundChange((round) => {
  playerHealth.setCurrentRound(round);
});

setupShooting(scene, enemyManager);

// Start the first round after a short delay
setTimeout(() => {
  roundManager.start();
}, 2000);

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener("resize", () => {
  engine.resize();
});
