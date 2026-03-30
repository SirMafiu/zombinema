import { HUD } from "./hud";

const MAX_HP = 100;

export class PlayerHealth {
  private hp: number = MAX_HP;
  private hud: HUD;
  private dead = false;
  private currentRound = 1;

  constructor(hud: HUD) {
    this.hud = hud;
    this.hud.updateHP(this.hp);
  }

  setCurrentRound(round: number): void {
    this.currentRound = round;
  }

  takeDamage(amount: number): void {
    if (this.dead) return;

    this.hp = Math.max(0, this.hp - amount);
    this.hud.updateHP(this.hp);

    if (this.hp <= 0) {
      this.die();
    }
  }

  isDead(): boolean {
    return this.dead;
  }

  private die(): void {
    this.dead = true;
    document.exitPointerLock();
    this.hud.showGameOver(this.currentRound);
  }
}
