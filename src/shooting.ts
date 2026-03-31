import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { EnemyManager } from "./enemy";
import { Weapon } from "./weapon";
import { HUD } from "./hud";
import { isPlayerMoving } from "./fps-controller";
import { gameEvents } from "./events";
import { ObjectPool } from "./object-pool";
import { PowerUpEffectManager } from "./powerup-effects";
import "@babylonjs/core/Culling/ray";

interface ImpactMarker {
  mesh: Mesh;
  matEnemy: StandardMaterial;
  matWall: StandardMaterial;
  elapsed: number;
  active: boolean;
}

interface MuzzleFlash {
  light: PointLight;
  elapsed: number;
  active: boolean;
}

export function setupShooting(
  scene: Scene,
  enemyManager: EnemyManager,
  hud: HUD,
  effectManager: PowerUpEffectManager,
): void {
  const camera = scene.activeCamera as UniversalCamera;
  const weapon = new Weapon(scene, camera);

  // --- Impact marker pool ---
  const impactPool = new ObjectPool<ImpactMarker>(
    () => {
      const id = `impact_${Math.floor(Math.random() * 100000)}`;
      const mesh = MeshBuilder.CreateSphere(id, { diameter: 0.15 }, scene);
      mesh.setEnabled(false);

      const matEnemy = new StandardMaterial(`${id}_mat_enemy`, scene);
      matEnemy.diffuseColor = new Color3(1, 0, 0);
      matEnemy.emissiveColor = new Color3(1, 0, 0);

      const matWall = new StandardMaterial(`${id}_mat_wall`, scene);
      matWall.diffuseColor = new Color3(1, 0.3, 0);
      matWall.emissiveColor = new Color3(1, 0.3, 0);

      return { mesh, matEnemy, matWall, elapsed: 0, active: false };
    },
    (marker) => {
      marker.mesh.setEnabled(false);
      marker.active = false;
      marker.elapsed = 0;
      marker.matEnemy.alpha = 1;
      marker.matWall.alpha = 1;
    },
    20,
  );

  // --- Muzzle flash pool ---
  const muzzlePool = new ObjectPool<MuzzleFlash>(
    () => {
      const light = new PointLight(`muzzle_${Math.floor(Math.random() * 100000)}`, Vector3.Zero(), scene);
      light.intensity = 0;
      light.diffuse = new Color3(1, 0.8, 0.3);
      light.range = 10;
      light.setEnabled(false);
      return { light, elapsed: 0, active: false };
    },
    (flash) => {
      flash.light.setEnabled(false);
      flash.light.intensity = 0;
      flash.active = false;
      flash.elapsed = 0;
    },
    5,
  );

  // Track active markers and flashes for per-frame update
  const activeMarkers: ImpactMarker[] = [];
  const activeFlashes: MuzzleFlash[] = [];

  let gameOver = false;

  gameEvents.on("playerDied", () => {
    gameOver = true;
  });

  window.addEventListener("click", () => {
    if (gameOver) return;
    if (!document.pointerLockElement) return;

    if (!weapon.shoot()) return;

    gameEvents.emit("weaponFired", {});

    const origin = camera.position.clone();
    const forward = camera.getForwardRay(1).direction.normalize();
    const ray = new Ray(origin, forward, 200);

    const hit = scene.pickWithRay(ray, (mesh) => {
      return (
        mesh.name !== "impact" &&
        !mesh.name.startsWith("impact_") &&
        !mesh.name.startsWith("weapon_")
      );
    });

    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      if (enemyManager.isEnemyMesh(hit.pickedMesh)) {
        const damage = 1 * effectManager.getDamageMultiplier();
        enemyManager.applyDamage(hit.pickedMesh, damage);
        gameEvents.emit("enemyHit", { position: hit.pickedPoint.clone(), damage });
        activateImpactMarker(hit.pickedPoint, true);
      } else {
        activateImpactMarker(hit.pickedPoint, false);
      }
    }

    activateMuzzleFlash(origin);
  });

  function activateImpactMarker(position: Vector3, isEnemy: boolean): void {
    const marker = impactPool.acquire();
    marker.mesh.position = position.clone();
    marker.mesh.position.y += 0.075;
    marker.mesh.material = isEnemy ? marker.matEnemy : marker.matWall;
    marker.mesh.setEnabled(true);
    marker.elapsed = 0;
    marker.active = true;
    const mat = isEnemy ? marker.matEnemy : marker.matWall;
    mat.alpha = 1;
    activeMarkers.push(marker);
  }

  function activateMuzzleFlash(position: Vector3): void {
    const flash = muzzlePool.acquire();
    flash.light.position = position.clone();
    flash.light.intensity = 3;
    flash.light.setEnabled(true);
    flash.elapsed = 0;
    flash.active = true;
    activeFlashes.push(flash);
  }

  // Reload on R key
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyR") {
      weapon.reload();
    }
  });

  // Per-frame update
  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime();
    weapon.update(dt, isPlayerMoving());

    // Update HUD ammo
    const ammo = weapon.getAmmo();
    hud.updateAmmo(ammo.current, ammo.max);
    hud.showReloading(weapon.isReloading());

    // Update active impact markers
    for (let i = activeMarkers.length - 1; i >= 0; i--) {
      const marker = activeMarkers[i];
      marker.elapsed += dt;
      const t = Math.min(marker.elapsed / 1000, 1);
      const mat = marker.mesh.material as StandardMaterial;
      mat.alpha = 1 - t;

      if (t >= 1) {
        activeMarkers.splice(i, 1);
        impactPool.release(marker);
      }
    }

    // Update active muzzle flashes
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
      const flash = activeFlashes[i];
      flash.elapsed += dt;

      if (flash.elapsed >= 100) {
        activeFlashes.splice(i, 1);
        muzzlePool.release(flash);
      }
    }
  });
}
