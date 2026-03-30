import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { gameEvents } from "./events";

const PICKUP_DISTANCE = 1.5;
const RESPAWN_COOLDOWN_MS = 30_000;
const BOB_MIN_Y = 0.5;
const BOB_MAX_Y = 1.2;
const BOB_SPEED = 2; // radians per second
const ROTATION_SPEED = 1.5; // radians per second

export interface PowerUpConfig {
  type: string;
  color: Color3;
  position: Vector3;
}

class PowerUp {
  readonly type: string;
  readonly spawnPosition: Vector3;
  private mesh: Mesh;
  private active = true;
  private respawnTimer = 0;
  private bobPhase = 0;

  constructor(scene: Scene, config: PowerUpConfig) {
    this.type = config.type;
    this.spawnPosition = config.position.clone();

    this.mesh = MeshBuilder.CreateBox(`powerup_${config.type}_${Math.floor(Math.random() * 100000)}`, { size: 0.6 }, scene);
    this.mesh.position = config.position.clone();
    this.mesh.position.y = BOB_MIN_Y;

    const mat = new StandardMaterial(`powerup_mat_${config.type}`, scene);
    mat.diffuseColor = config.color;
    mat.emissiveColor = config.color.scale(0.6);
    mat.alpha = 0.9;
    this.mesh.material = mat;
    this.mesh.isPickable = false;
  }

  update(dt: number, playerPosition: Vector3): boolean {
    if (!this.active) {
      this.respawnTimer += dt;
      if (this.respawnTimer >= RESPAWN_COOLDOWN_MS) {
        this.active = true;
        this.mesh.setEnabled(true);
        this.respawnTimer = 0;
      }
      return false;
    }

    // Bob animation
    this.bobPhase += (dt / 1000) * BOB_SPEED;
    const t = (Math.sin(this.bobPhase) + 1) / 2; // 0..1
    this.mesh.position.y = BOB_MIN_Y + t * (BOB_MAX_Y - BOB_MIN_Y);

    // Rotation
    this.mesh.rotation.y += (dt / 1000) * ROTATION_SPEED;

    // Proximity check (XZ distance only)
    const dx = playerPosition.x - this.spawnPosition.x;
    const dz = playerPosition.z - this.spawnPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < PICKUP_DISTANCE) {
      this.collect();
      return true;
    }

    return false;
  }

  private collect(): void {
    this.active = false;
    this.mesh.setEnabled(false);
    this.respawnTimer = 0;
  }
}

export class PowerUpManager {
  private powerUps: PowerUp[] = [];

  addPowerUp(scene: Scene, config: PowerUpConfig): void {
    this.powerUps.push(new PowerUp(scene, config));
  }

  update(dt: number, playerPosition: Vector3): void {
    for (const pu of this.powerUps) {
      const collected = pu.update(dt, playerPosition);
      if (collected) {
        gameEvents.emit("powerupCollected", { type: pu.type });
      }
    }
  }
}
