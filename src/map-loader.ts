import { Scene } from "@babylonjs/core/scene";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF";
import type { MapData } from "./map";

/**
 * Load a .glb map file and extract collision walls, spawn points, and player start.
 *
 * CONVENTION for your Blender model:
 * - Name meshes starting with "wall_" for collision walls (player & enemies can't walk through)
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
export async function loadMap(scene: Scene, path: string): Promise<MapData> {
  const result = await SceneLoader.ImportMeshAsync("", path, "", scene);

  const walls: Mesh[] = [];
  const spawnPoints: Vector3[] = [];
  const powerUpSpawns: Vector3[] = [];
  let playerStart = new Vector3(0, 1.8, 0);

  for (const mesh of result.meshes) {
    const name = mesh.name.toLowerCase();

    if (name.startsWith("wall_") && mesh instanceof Mesh) {
      mesh.checkCollisions = true;
      mesh.isVisible = true;
      walls.push(mesh);
    } else if (name === "player_start") {
      playerStart = new Vector3(mesh.position.x, 1.8, mesh.position.z);
      mesh.isVisible = false;
    } else if (name.startsWith("spawn_")) {
      spawnPoints.push(new Vector3(mesh.position.x, 0.75, mesh.position.z));
      mesh.isVisible = false;
    } else if (name.startsWith("powerup_")) {
      powerUpSpawns.push(new Vector3(mesh.position.x, 0, mesh.position.z));
      mesh.isVisible = false;
    }
  }

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

  return { walls, spawnPoints, playerStart, powerUpSpawns };
}
