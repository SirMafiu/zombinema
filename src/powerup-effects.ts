import { gameEvents } from "./events";

interface ActiveEffect {
  type: string;
  remaining: number;
  damageMultiplier: number;
}

export class PowerUpEffectManager {
  private activeEffects: ActiveEffect[] = [];

  constructor() {
    gameEvents.on("powerupCollected", (data) => {
      this.applyEffect(data.type);
    });
  }

  private applyEffect(type: string): void {
    if (type === "compilateur") {
      // Remove existing compilateur effect if any (refresh duration)
      this.activeEffects = this.activeEffects.filter((e) => e.type !== "compilateur");
      this.activeEffects.push({
        type: "compilateur",
        remaining: 8000, // 8 seconds in ms
        damageMultiplier: 5,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.remaining -= dt;
      if (effect.remaining <= 0) {
        this.activeEffects.splice(i, 1);
        gameEvents.emit("powerupExpired", { type: effect.type });
      }
    }
  }

  getDamageMultiplier(): number {
    let multiplier = 1;
    for (const effect of this.activeEffects) {
      multiplier *= effect.damageMultiplier;
    }
    return multiplier;
  }

  getRemainingTime(type: string): number {
    const effect = this.activeEffects.find((e) => e.type === type);
    return effect ? effect.remaining : 0;
  }

  isActive(type: string): boolean {
    return this.activeEffects.some((e) => e.type === type);
  }
}
