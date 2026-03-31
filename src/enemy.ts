import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Observer } from "@babylonjs/core/Misc/observable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF";
import { clampToMap } from "./map";
import { gameEvents } from "./events";

const ENEMY_SPEED = 2;
const ENEMY_HP = 3;
const ENEMY_SIZE = 0.25;
const ATTACK_RANGE = 1.5;
const ATTACK_COOLDOWN = 1000; // ms
const ENEMY_RADIUS = 0.6;
const ENEMY_HEIGHT = 1.5;
const GRAVITY = 20;

type ZombieAnim = "idle" | "walk" | "attack" | "crawl";

interface Enemy {
  root: AbstractMesh;
  meshes: AbstractMesh[];
  anims: Map<ZombieAnim, AnimationGroup>;
  currentAnim: ZombieAnim | null;
  hp: number;
  lastAttackTime: number;
  dying: boolean;
  velocityY: number;
  groundY: number;
}

export class EnemyManager {
  private scene: Scene;
  private activeEnemies: Enemy[] = [];
  private pool: Enemy[] = [];
  private enemyByMeshId = new Map<string, Enemy>();
  private updateObserver: Observer<Scene> | null = null;
  private walls: Mesh[] = [];
  private floors: Mesh[] = [];
  private spawnPoints: Vector3[] = [];
  private container: AssetContainer | null = null;
  private ready = false;

  constructor(scene: Scene) {
    this.scene = scene;

    this.updateObserver = scene.onBeforeRenderObservable.add(() => {
      this.update();
    });

    this.loadTemplate();
  }

  private async loadTemplate(): Promise<void> {
    this.container = await SceneLoader.LoadAssetContainerAsync(
      "/assets/", "zombie_2.glb", this.scene,
    );
    this.ready = true;
  }

  private playAnim(enemy: Enemy, name: ZombieAnim, loop: boolean = true): void {
    if (enemy.currentAnim === name) return;
    if (enemy.currentAnim) {
      const current = enemy.anims.get(enemy.currentAnim);
      if (current) current.stop();
    }
    const anim = enemy.anims.get(name);
    if (anim) {
      anim.start(loop);
      enemy.currentAnim = name;
    }
  }

  private createEnemy(): Enemy {
    const instance = this.container!.instantiateModelsToScene();

    const root = instance.rootNodes[0] as AbstractMesh;
    root.scaling.setAll(ENEMY_SIZE);

    const meshes = root.getChildMeshes();

    const anims = new Map<ZombieAnim, AnimationGroup>();
    for (const ag of instance.animationGroups) {
      const name = ag.name.toLowerCase();
      if (name.includes("idle")) anims.set("idle", ag);
      else if (name.includes("walk")) anims.set("walk", ag);
      else if (name.includes("attack") || name.includes("bite")) anims.set("attack", ag);
      else if (name.includes("crawl")) anims.set("crawl", ag);
    }

    for (const ag of instance.animationGroups) {
      ag.stop();
    }

    return {
      root,
      meshes,
      anims,
      currentAnim: null,
      hp: ENEMY_HP,
      lastAttackTime: 0,
      dying: false,
      velocityY: 0,
      groundY: 0,
    };
  }

  private acquireEnemy(): Enemy {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createEnemy();
  }

  private releaseToPool(enemy: Enemy): void {
    this.deactivateEnemy(enemy);
    this.pool.push(enemy);
  }

  private activateEnemy(enemy: Enemy, x: number, z: number): void {
    enemy.hp = ENEMY_HP;
    enemy.lastAttackTime = 0;
    enemy.dying = false;
    enemy.currentAnim = null;
    enemy.velocityY = 0;
    enemy.groundY = 0;
    enemy.root.position = new Vector3(x, 0, z);
    enemy.root.rotation = Vector3.Zero();
    enemy.root.setEnabled(true);

    this.playAnim(enemy, "walk");

    this.enemyByMeshId.set(enemy.root.uniqueId.toString(), enemy);
    for (const mesh of enemy.meshes) {
      this.enemyByMeshId.set(mesh.uniqueId.toString(), enemy);
    }
  }

  private deactivateEnemy(enemy: Enemy): void {
    enemy.root.setEnabled(false);
    enemy.dying = false;

    for (const ag of enemy.anims.values()) {
      ag.stop();
    }
    enemy.currentAnim = null;

    this.enemyByMeshId.delete(enemy.root.uniqueId.toString());
    for (const mesh of enemy.meshes) {
      this.enemyByMeshId.delete(mesh.uniqueId.toString());
    }
  }

  setWalls(walls: Mesh[]): void {
    this.walls = walls;
  }

  setFloors(floors: Mesh[]): void {
    this.floors = floors;
  }

  setSpawnPoints(points: Vector3[]): void {
    this.spawnPoints = points;
  }

  spawnEnemy(): void {
    if (!this.ready) return;

    let x: number;
    let z: number;

    if (this.spawnPoints.length > 0) {
      const point = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      x = point.x + (Math.random() - 0.5) * 3;
      z = point.z + (Math.random() - 0.5) * 3;
    } else {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 10;
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
    }

    const enemy = this.acquireEnemy();
    this.activateEnemy(enemy, x, z);
    this.activeEnemies.push(enemy);
  }

  private getGroundY(position: Vector3): number {
    const groundMeshes = [...this.walls, ...this.floors];
    if (groundMeshes.length === 0) return 0;

    const rayOrigin = new Vector3(position.x, position.y + ENEMY_HEIGHT, position.z);
    const ray = new Ray(rayOrigin, Vector3.Down(), ENEMY_HEIGHT + 2);
    let groundY = 0;

    for (const mesh of groundMeshes) {
      const hit = ray.intersectsMesh(mesh);
      if (hit.hit && hit.pickedPoint && hit.pickedPoint.y > groundY) {
        groundY = hit.pickedPoint.y;
      }
    }

    return groundY;
  }

  private update(): void {
    const camera = this.scene.activeCamera;
    if (!camera) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    const playerPos = camera.position;
    const now = performance.now();

    for (const enemy of this.activeEnemies) {
      if (enemy.dying) continue;

      // Move toward player (XZ only)
      const dir = playerPos.subtract(enemy.root.position);
      const heightDiff = Math.abs(dir.y);
      dir.y = 0;
      const dist = dir.length();
      const sameFloor = heightDiff < 2;

      if (dist > ATTACK_RANGE || !sameFloor) {
        this.playAnim(enemy, "walk");

        dir.normalize();
        const step = dir.scaleInPlace(ENEMY_SPEED * dt);
        const nextPos = enemy.root.position.add(step);

        if (this.walls.length > 0) {
          const feetY = enemy.root.position.y;
          const clamped = clampToMap(nextPos, this.walls, ENEMY_RADIUS, feetY);
          enemy.root.position.x = clamped.x;
          enemy.root.position.z = clamped.z;
        } else {
          enemy.root.position.x = nextPos.x;
          enemy.root.position.z = nextPos.z;
        }
      } else {
        this.playAnim(enemy, "attack");

        if (now - enemy.lastAttackTime >= ATTACK_COOLDOWN) {
          enemy.lastAttackTime = now;
          gameEvents.emit("playerDamaged", { damage: 1 });
        }
      }

      // Ground detection via raycast
      const groundY = this.getGroundY(enemy.root.position);
      enemy.groundY = groundY;

      // Apply gravity
      enemy.velocityY -= GRAVITY * dt;
      enemy.root.position.y += enemy.velocityY * dt;

      if (enemy.root.position.y <= groundY) {
        enemy.root.position.y = groundY;
        enemy.velocityY = 0;
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

    gameEvents.emit("enemyKilled", { position });

    this.playAnim(enemy, "crawl", false);

    const deathDuration = 1500;
    const startTime = performance.now();
    const startY = enemy.root.position.y;

    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / deathDuration, 1);

      enemy.root.position.y = startY - t * 1.5;

      if (t >= 1) {
        this.scene.onBeforeRenderObservable.remove(obs);
        this.removeFromActive(enemy);
        this.releaseToPool(enemy);
        gameEvents.emit("enemyDied", { position });
      }
    });
  }

  private removeFromActive(enemy: Enemy): void {
    const idx = this.activeEnemies.indexOf(enemy);
    if (idx !== -1) {
      this.activeEnemies.splice(idx, 1);
    }
  }

  get aliveCount(): number {
    return this.activeEnemies.filter((e) => !e.dying).length;
  }

  disposeAll(): void {
    for (const enemy of [...this.activeEnemies]) {
      this.removeFromActive(enemy);
      this.deactivateEnemy(enemy);
    }
    this.activeEnemies = [];
    // Also clear the pool
    for (const enemy of this.pool) {
      for (const mesh of enemy.meshes) mesh.dispose();
      enemy.root.dispose();
      for (const ag of enemy.anims.values()) ag.dispose();
    }
    this.pool = [];
  }

  dispose(): void {
    this.disposeAll();
    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }
    if (this.container) {
      this.container.dispose();
    }
  }
}
