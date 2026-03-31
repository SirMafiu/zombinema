import { gameEvents } from "./events";

const MAX_HP = 100;

export class PlayerHealth {
  private hp: number = MAX_HP;
  private dead = false;
  private currentRound = 1;

  constructor() {
    gameEvents.on("playerDamaged", (data) => {
      this.takeDamage(data.damage);
    });

    gameEvents.on("roundChanged", (data) => {
      this.currentRound = data.round;
    });
  }

  private takeDamage(amount: number): void {
    if (this.dead) return;

    this.hp = Math.max(0, this.hp - amount);
    gameEvents.emit("playerHpChanged", { currentHp: this.hp, maxHp: MAX_HP });

    if (this.hp <= 0) {
      this.die();
    }
  }

  isDead(): boolean {
    return this.dead;
  }

  private die(): void {
    this.dead = true;
    gameEvents.emit("playerDied", { round: this.currentRound });
  }
}
