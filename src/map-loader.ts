import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF";
import type { MapData } from "./map";

/**
 * Load a .glb map file and extract collision walls, spawn points, and player start.
 *
 * CONVENTION for your Blender model:
 * - Name meshes starting with "wall_" for collision walls (player & enemies can't walk through)
 * - Name meshes starting with "stair_" for solid stairs (collision, walkable)
 * - Name meshes starting with "floor_" for ground/floor surfaces (collision, walkable)
 * - Name a mesh "player_start" to define the player spawn position (uses mesh position)
 * - Name meshes starting with "spawn_" for enemy spawn points (uses mesh position)
 * - Name meshes starting with "powerup_" for power-up locations (uses mesh position)
 * - All other meshes are visual-only (rendered but no collision)
 *
 * Example Blender object names:
 *   wall_north, wall_corridor_left, wall_door_frame
 *   player_start
 *   spawn_server_room, spawn_kitchen, spawn_corridor_north
 *   powerup_server_room, powerup_kitchen
 */
export async function loadMap(scene: Scene, path: string, scale: number = 2): Promise<MapData> {
  const result = await SceneLoader.ImportMeshAsync("", path, "", scene);

  // Scale the entire map up so doors/stairs are large enough for the player
  const root = result.meshes[0];
  if (root) {
    root.scaling.scaleInPlace(scale);
  }

  // Force bounding info recomputation after scaling
  for (const mesh of result.meshes) {
    mesh.computeWorldMatrix(true);
    if (mesh instanceof Mesh) {
      mesh.refreshBoundingInfo();
    }
  }

  const walls: Mesh[] = [];
  const floors: Mesh[] = [];
  const spawnPoints: Vector3[] = [];
  const powerUpSpawns: Vector3[] = [];
  let playerStart = new Vector3(0, 1.8, 0);

  for (const mesh of result.meshes) {
    const name = mesh.name.toLowerCase();

    if ((name.startsWith("wall_") || name.startsWith("stair_")) && mesh instanceof Mesh) {
      mesh.checkCollisions = true;
      mesh.isVisible = true;
      walls.push(mesh);
      // Stairs and walls also serve as walkable floors
      floors.push(mesh);
    } else if (name.startsWith("floor_") && mesh instanceof Mesh) {
      // Explicit floor meshes for ground detection
      mesh.checkCollisions = true;
      floors.push(mesh);
    } else if (name === "player_start") {
      const absPos = mesh.getAbsolutePosition();
      playerStart = new Vector3(absPos.x, absPos.y + 1.8, absPos.z);
      mesh.isVisible = false;
    } else if (name.startsWith("spawn_")) {
      const absPos = mesh.getAbsolutePosition();
      spawnPoints.push(new Vector3(absPos.x, absPos.y + 0.75, absPos.z));
      mesh.isVisible = false;
    } else if (name.startsWith("powerup_")) {
      const absPos = mesh.getAbsolutePosition();
      powerUpSpawns.push(new Vector3(absPos.x, absPos.y, absPos.z));
      mesh.isVisible = false;
    }
  }

  // Large ground floor plane (rez-de-chaussée) — 100x100m, centered at origin
  const ground = MeshBuilder.CreateGround("floor_ground", { width: 100, height: 100 }, scene);
  ground.position.y = -0.01; // slightly below to avoid z-fighting with GLB floors
  ground.checkCollisions = true;
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.3, 0.3, 0.3);
  ground.material = groundMat;
  floors.push(ground);

  // Fallback: if no spawn points defined in the model, use corners
  if (spawnPoints.length === 0) {
    console.warn("[map-loader] No spawn_ meshes found, using default spawn points");
    spawnPoints.push(
      new Vector3(10, 0.75, 10),
      new Vector3(-10, 0.75, 10),
      new Vector3(10, 0.75, -10),
      new Vector3(-10, 0.75, -10),
    );
  }

  return { walls, floors, spawnPoints, playerStart, powerUpSpawns };
}
