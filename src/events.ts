import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type EventMap = {
  enemyDied: { position: Vector3 };
  playerDamaged: { damage: number; currentHp: number };
  playerDied: { round: number };
  roundChanged: { round: number };
  roundCleared: {};
  enemyHit: { position: Vector3; damage: number };
  weaponFired: {};
  weaponReloaded: {};
  powerupCollected: { type: string };
  powerupExpired: { type: string };
};

type Callback<K extends keyof EventMap> = (data: EventMap[K]) => void;

class GameEvents {
  private listeners = new Map<keyof EventMap, Set<Callback<never>>>();

  on<K extends keyof EventMap>(event: K, callback: Callback<K>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback as Callback<never>);
  }

  off<K extends keyof EventMap>(event: K, callback: Callback<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as Callback<never>);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        (cb as Callback<K>)(data);
      }
    }
  }
}

export const gameEvents = new GameEvents();
