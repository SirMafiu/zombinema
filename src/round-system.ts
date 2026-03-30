import { EnemyManager } from "./enemy";
import { HUD } from "./hud";

const INTER_ROUND_DELAY = 3000;

export class RoundManager {
  private round = 0;
  private enemiesRemaining = 0;
  private enemyManager: EnemyManager;
  private hud: HUD;
  private onRoundChange: ((round: number) => void) | null = null;

  constructor(enemyManager: EnemyManager, hud: HUD) {
    this.enemyManager = enemyManager;
    this.hud = hud;

    this.enemyManager.setOnEnemyDeath(() => {
      this.enemiesRemaining--;
      if (this.enemiesRemaining <= 0) {
        this.onRoundCleared();
      }
    });
  }

  setOnRoundChange(cb: (round: number) => void): void {
    this.onRoundChange = cb;
  }

  start(): void {
    this.startRound();
  }

  private startRound(): void {
    this.round++;
    const enemyCount = 2 + this.round * 2;
    this.enemiesRemaining = enemyCount;

    this.hud.updateRound(this.round);
    this.hud.showAnnouncement(`Round ${this.round}`);
    this.onRoundChange?.(this.round);

    for (let i = 0; i < enemyCount; i++) {
      this.enemyManager.spawnEnemy();
    }
  }

  private onRoundCleared(): void {
    setTimeout(() => {
      this.startRound();
    }, INTER_ROUND_DELAY);
  }

  get currentRound(): number {
    return this.round;
  }
}
