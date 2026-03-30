import { Scene } from "@babylonjs/core/scene";
import { Ray } from "@babylonjs/core/Culling/ray";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { EnemyManager } from "./enemy";
import "@babylonjs/core/Culling/ray";

export function setupShooting(scene: Scene, enemyManager: EnemyManager): void {
  let markerCounter = 0;

  window.addEventListener("click", () => {
    if (!document.pointerLockElement) return;

    const camera = scene.activeCamera!;
    const origin = camera.position.clone();

    const forward = camera.getForwardRay(1).direction.normalize();
    const ray = new Ray(origin, forward, 200);

    const hit = scene.pickWithRay(ray, (mesh) => {
      return mesh.name !== "impact" && !mesh.name.startsWith("impact_");
    });

    if (hit?.hit && hit.pickedPoint && hit.pickedMesh) {
      if (enemyManager.isEnemyMesh(hit.pickedMesh)) {
        enemyManager.applyDamage(hit.pickedMesh, 1);
        spawnImpactMarker(scene, hit.pickedPoint, markerCounter++, true);
      } else {
        spawnImpactMarker(scene, hit.pickedPoint, markerCounter++, false);
      }
    }

    spawnMuzzleFlash(scene, origin);
  });
}

function spawnImpactMarker(
  scene: Scene,
  position: Vector3,
  id: number,
  isEnemy: boolean
): void {
  const sphere = MeshBuilder.CreateSphere(
    `impact_${id}`,
    { diameter: 0.15 },
    scene
  );
  sphere.position = position.clone();
  sphere.position.y += 0.075;

  const color = isEnemy ? new Color3(1, 0, 0) : new Color3(1, 0.3, 0);
  const mat = new StandardMaterial(`impact_mat_${id}`, scene);
  mat.diffuseColor = color;
  mat.emissiveColor = color;
  sphere.material = mat;

  let elapsed = 0;
  const obs = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime();
    const t = Math.min(elapsed / 1000, 1);
    mat.alpha = 1 - t;

    if (t >= 1) {
      scene.onBeforeRenderObservable.remove(obs);
      sphere.dispose();
      mat.dispose();
    }
  });
}

function spawnMuzzleFlash(scene: Scene, position: Vector3): void {
  const light = new PointLight("muzzle", position.clone(), scene);
  light.intensity = 3;
  light.diffuse = new Color3(1, 0.8, 0.3);
  light.range = 10;

  let elapsed = 0;
  const obs = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime();

    if (elapsed >= 100) {
      scene.onBeforeRenderObservable.remove(obs);
      light.dispose();
    }
  });
}
