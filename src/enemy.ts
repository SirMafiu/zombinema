import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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

type ZombieAnim = "idle" | "walk" | "attack" | "crawl";

interface Enemy {
  root: AbstractMesh;
  meshes: AbstractMesh[];
  anims: Map<ZombieAnim, AnimationGroup>;
  currentAnim: ZombieAnim | null;
  hp: number;
  lastAttackTime: number;
  dying: boolean;
}

export class EnemyManager {
  private scene: Scene;
  private enemies: Enemy[] = [];
  private enemyByMeshId = new Map<string, Enemy>();
  private updateObserver: Observer<Scene> | null = null;
  private walls: Mesh[] = [];
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
    // Stop current animation
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

    // Collect all child meshes for hit detection
    const meshes = root.getChildMeshes();

    // Map animation groups by name
    const anims = new Map<ZombieAnim, AnimationGroup>();
    for (const ag of instance.animationGroups) {
      const name = ag.name.toLowerCase();
      if (name.includes("idle")) anims.set("idle", ag);
      else if (name.includes("walk")) anims.set("walk", ag);
      else if (name.includes("attack") || name.includes("bite")) anims.set("attack", ag);
      else if (name.includes("crawl")) anims.set("crawl", ag);
    }

    // Stop all animations initially
    for (const ag of instance.animationGroups) {
      ag.stop();
    }

    const enemy: Enemy = {
      root,
      meshes,
      anims,
      currentAnim: null,
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
    enemy.currentAnim = null;
    enemy.root.position = new Vector3(x, 0, z);
    enemy.root.rotation = Vector3.Zero();
    enemy.root.setEnabled(true);

    // Start walk animation
    this.playAnim(enemy, "walk");

    // Register in lookup map
    this.enemyByMeshId.set(enemy.root.uniqueId.toString(), enemy);
    for (const mesh of enemy.meshes) {
      this.enemyByMeshId.set(mesh.uniqueId.toString(), enemy);
    }
  }

  private deactivateEnemy(enemy: Enemy): void {
    enemy.root.setEnabled(false);
    enemy.dying = false;

    // Stop animations
    for (const ag of enemy.anims.values()) {
      ag.stop();
    }
    enemy.currentAnim = null;

    // Unregister from lookup map
    this.enemyByMeshId.delete(enemy.root.uniqueId.toString());
    for (const mesh of enemy.meshes) {
      this.enemyByMeshId.delete(mesh.uniqueId.toString());
    }
  }

  setWalls(walls: Mesh[]): void {
    this.walls = walls;
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

    const enemy = this.createEnemy();
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

      // Move toward player (XZ only)
      const dir = playerPos.subtract(enemy.root.position);
      const heightDiff = Math.abs(dir.y);
      dir.y = 0;
      const dist = dir.length();
      const sameFloor = heightDiff < 2;

      if (dist > ATTACK_RANGE || !sameFloor) {
        // Walk toward player
        this.playAnim(enemy, "walk");

        dir.normalize();
        const step = dir.scaleInPlace(ENEMY_SPEED * dt);
        const nextPos = enemy.root.position.add(step);
        nextPos.y = 0;

        if (this.walls.length > 0) {
          const clamped = clampToMap(nextPos, this.walls, ENEMY_RADIUS);
          enemy.root.position.x = clamped.x;
          enemy.root.position.z = clamped.z;
        } else {
          enemy.root.position.x = nextPos.x;
          enemy.root.position.z = nextPos.z;
        }

        enemy.root.position.y = 0;
      } else {
        // Same floor AND in range — attack
        this.playAnim(enemy, "attack");

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

    // Play crawl as death animation (no dedicated death anim)
    this.playAnim(enemy, "crawl", false);

    const deathDuration = 1500;
    const startTime = performance.now();

    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / deathDuration, 1);

      // Sink into ground
      enemy.root.position.y = -(t * 1.5);

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
    this.deactivateEnemy(enemy);
    for (const mesh of enemy.meshes) {
      mesh.dispose();
    }
    enemy.root.dispose();
    for (const ag of enemy.anims.values()) {
      ag.dispose();
    }
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
    if (this.container) {
      this.container.dispose();
    }
  }
}
