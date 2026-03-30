import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Observer } from "@babylonjs/core/Misc/observable";
import { clampToMap } from "./map";
import { gameEvents } from "./events";
import { ObjectPool } from "./object-pool";

const ENEMY_SPEED = 2;
const ENEMY_HP = 3;
const ENEMY_SIZE = 1.5;
const ATTACK_RANGE = 1.5;
const ATTACK_COOLDOWN = 1000; // ms
const DEATH_ANIM_DURATION = 400; // ms
const ENEMY_RADIUS = 0.6;

interface Enemy {
  root: Mesh;
  body: Mesh;
  leftEye: Mesh;
  rightEye: Mesh;
  hp: number;
  lastAttackTime: number;
  dying: boolean;
}

export class EnemyManager {
  private scene: Scene;
  private enemies: Enemy[] = [];
  private enemyByMeshId = new Map<string, Enemy>();
  private updateObserver: Observer<Scene> | null = null;
  private bodyMat: StandardMaterial;
  private eyeMat: StandardMaterial;
  private walls: Mesh[] = [];
  private spawnPoints: Vector3[] = [];
  private meshPool: ObjectPool<Enemy>;

  constructor(scene: Scene) {
    this.scene = scene;

    this.bodyMat = new StandardMaterial("enemyBodyMat", scene);
    this.bodyMat.diffuseColor = new Color3(0.7, 0.15, 0.15);

    this.eyeMat = new StandardMaterial("enemyEyeMat", scene);
    this.eyeMat.diffuseColor = new Color3(1, 1, 1);
    this.eyeMat.emissiveColor = new Color3(0.5, 0.5, 0.5);

    this.meshPool = new ObjectPool<Enemy>(
      () => this.createEnemyMeshGroup(),
      (enemy) => this.deactivateEnemy(enemy),
      20,
    );

    this.updateObserver = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
  }

  private createEnemyMeshGroup(): Enemy {
    const id = `enemy_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const root = new Mesh(id, this.scene);
    root.position = new Vector3(0, ENEMY_SIZE / 2, 0);

    const body = MeshBuilder.CreateBox(`${id}_body`, { size: ENEMY_SIZE }, this.scene);
    body.material = this.bodyMat;
    body.parent = root;

    const eyeSize = 0.2;
    const eyeOffset = ENEMY_SIZE / 2 + 0.01;
    const eyeY = 0.25;
    const eyeSpacing = 0.3;

    const leftEye = MeshBuilder.CreateSphere(`${id}_eyeL`, { diameter: eyeSize }, this.scene);
    leftEye.material = this.eyeMat;
    leftEye.parent = root;
    leftEye.position = new Vector3(-eyeSpacing, eyeY, eyeOffset);

    const rightEye = MeshBuilder.CreateSphere(`${id}_eyeR`, { diameter: eyeSize }, this.scene);
    rightEye.material = this.eyeMat;
    rightEye.parent = root;
    rightEye.position = new Vector3(eyeSpacing, eyeY, eyeOffset);

    const enemy: Enemy = {
      root,
      body,
      leftEye,
      rightEye,
      hp: ENEMY_HP,
      lastAttackTime: 0,
      dying: false,
    };

    return enemy;
  }

  private activateEnemy(enemy: Enemy, x: number, z: number): void {
    enemy.hp = ENEMY_HP;
    enemy.lastAttackTime = 0;
    enemy.dying = false;
    enemy.root.position = new Vector3(x, ENEMY_SIZE / 2, z);
    enemy.root.rotation.x = 0;
    enemy.root.rotation.y = 0;
    enemy.root.rotation.z = 0;
    enemy.root.setEnabled(true);

    // Register in lookup map
    this.enemyByMeshId.set(enemy.root.uniqueId.toString(), enemy);
    this.enemyByMeshId.set(enemy.body.uniqueId.toString(), enemy);
    this.enemyByMeshId.set(enemy.leftEye.uniqueId.toString(), enemy);
    this.enemyByMeshId.set(enemy.rightEye.uniqueId.toString(), enemy);
  }

  private deactivateEnemy(enemy: Enemy): void {
    enemy.root.setEnabled(false);
    enemy.dying = false;

    // Unregister from lookup map
    this.enemyByMeshId.delete(enemy.root.uniqueId.toString());
    this.enemyByMeshId.delete(enemy.body.uniqueId.toString());
    this.enemyByMeshId.delete(enemy.leftEye.uniqueId.toString());
    this.enemyByMeshId.delete(enemy.rightEye.uniqueId.toString());
  }

  setWalls(walls: Mesh[]): void {
    this.walls = walls;
  }

  setSpawnPoints(points: Vector3[]): void {
    this.spawnPoints = points;
  }

  spawnEnemy(): void {
    let x: number;
    let z: number;

    if (this.spawnPoints.length > 0) {
      const point = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      // Add some jitter so enemies don't stack
      x = point.x + (Math.random() - 0.5) * 3;
      z = point.z + (Math.random() - 0.5) * 3;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 10;
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
    }

    const enemy = this.meshPool.acquire();
    this.activateEnemy(enemy, x, z);
    this.enemies.push(enemy);
  }

  private update(): void {
    const camera = this.scene.activeCamera;
    if (!camera) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    const playerPos = camera.position;
    const now = performance.now();

    for (const enemy of this.enemies) {
      if (enemy.dying) continue;

      // Move toward player
      const dir = playerPos.subtract(enemy.root.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist > ATTACK_RANGE) {
        dir.normalize();
        const step = dir.scaleInPlace(ENEMY_SPEED * dt);
        const nextPos = enemy.root.position.add(step);
        nextPos.y = ENEMY_SIZE / 2;

        // Wall collision with sliding
        if (this.walls.length > 0) {
          const clamped = clampToMap(nextPos, this.walls, ENEMY_RADIUS);
          enemy.root.position.x = clamped.x;
          enemy.root.position.z = clamped.z;
        } else {
          enemy.root.position.x = nextPos.x;
          enemy.root.position.z = nextPos.z;
        }

        // Keep on ground
        enemy.root.position.y = ENEMY_SIZE / 2;
      } else {
        // Attack player
        if (now - enemy.lastAttackTime >= ATTACK_COOLDOWN) {
          enemy.lastAttackTime = now;
          gameEvents.emit("playerDamaged", { damage: 1, currentHp: -1 });
        }
      }

      // Face the player
      const lookDir = playerPos.subtract(enemy.root.position);
      lookDir.y = 0;
      if (lookDir.lengthSquared() > 0.001) {
        const angle = Math.atan2(lookDir.x, lookDir.z);
        enemy.root.rotation.y = angle;
      }
    }
  }

  isEnemyMesh(mesh: AbstractMesh): boolean {
    return this.enemyByMeshId.has(mesh.uniqueId.toString());
  }

  applyDamage(mesh: AbstractMesh, amount: number): void {
    const enemy =
      this.enemyByMeshId.get(mesh.uniqueId.toString()) ??
      (mesh.parent ? this.enemyByMeshId.get((mesh.parent as AbstractMesh).uniqueId.toString()) : undefined);
    if (!enemy || enemy.dying) return;

    enemy.hp -= amount;
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  private killEnemy(enemy: Enemy): void {
    enemy.dying = true;
    const position = enemy.root.position.clone();
    const startTime = performance.now();

    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DEATH_ANIM_DURATION, 1);

      // Fall over on X axis
      enemy.root.rotation.x = (t * Math.PI) / 2;
      // Sink slightly
      enemy.root.position.y = (ENEMY_SIZE / 2) * (1 - t * 0.5);

      if (t >= 1) {
        this.scene.onBeforeRenderObservable.remove(obs);
        this.releaseEnemy(enemy);
        gameEvents.emit("enemyDied", { position });
      }
    });
  }

  private releaseEnemy(enemy: Enemy): void {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }
    this.meshPool.release(enemy);
  }

  get aliveCount(): number {
    return this.enemies.filter((e) => !e.dying).length;
  }

  disposeAll(): void {
    for (const enemy of [...this.enemies]) {
      this.releaseEnemy(enemy);
    }
    this.enemies = [];
  }

  dispose(): void {
    this.disposeAll();
    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }
    this.bodyMat.dispose();
    this.eyeMat.dispose();
  }
}
