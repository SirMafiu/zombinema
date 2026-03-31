import { EnemyManager } from "./enemy";
import { gameEvents } from "./events";

const INTER_ROUND_DELAY = 3000;

export class RoundManager {
  private round = 0;
  private enemiesRemaining = 0;
  private enemyManager: EnemyManager;
  private delayElapsed = 0;
  private waitingForNextRound = false;
  private started = false;

  constructor(enemyManager: EnemyManager) {
    this.enemyManager = enemyManager;

    gameEvents.on("enemyKilled", () => {
      this.enemiesRemaining--;
      if (this.enemiesRemaining <= 0) {
        this.onRoundCleared();
      }
    });
  }

  start(): void {
    this.started = true;
    this.startRound();
  }

  /** Must be called each frame with delta time in ms. */
  update(dt: number): void {
    if (!this.waitingForNextRound) return;

    this.delayElapsed += dt;
    if (this.delayElapsed >= INTER_ROUND_DELAY) {
      this.waitingForNextRound = false;
      this.startRound();
    }
  }

  private startRound(): void {
    this.round++;
    const enemyCount = 2 + this.round * 2;
    this.enemiesRemaining = enemyCount;

    gameEvents.emit("roundChanged", { round: this.round });

    for (let i = 0; i < enemyCount; i++) {
      this.enemyManager.spawnEnemy();
    }
  }

  private onRoundCleared(): void {
    gameEvents.emit("roundCleared", {});
    this.waitingForNextRound = true;
    this.delayElapsed = 0;
  }

  get currentRound(): number {
    return this.round;
  }
}
