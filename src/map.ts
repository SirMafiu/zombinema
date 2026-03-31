import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.3;

// Total map: 50 x 40 (X x Z), centered at origin
// Corridor runs along Z axis: x from -2 to +2, z from -20 to +20

export interface MapData {
  walls: Mesh[];
  floors?: Mesh[];
  spawnPoints: Vector3[];
  playerStart: Vector3;
  powerUpSpawns: Vector3[];
}

interface WallDef {
  x: number;
  z: number;
  width: number;
  depth: number;
}

function wallDefs(): WallDef[] {
  const walls: WallDef[] = [];

  // --- Outer walls ---
  // North wall (z = +20)
  walls.push({ x: 0, z: 20, width: 50, depth: WALL_THICKNESS });
  // South wall (z = -20)
  walls.push({ x: 0, z: -20, width: 50, depth: WALL_THICKNESS });
  // West wall (x = -25)
  walls.push({ x: -25, z: 0, width: WALL_THICKNESS, depth: 40 });
  // East wall (x = +25)
  walls.push({ x: 25, z: 0, width: WALL_THICKNESS, depth: 40 });

  // --- Corridor walls (west side, x = -2) ---
  // Corridor west wall with doorway gaps
  // From z=-20 to z=-13 (solid)
  walls.push({ x: -2, z: -16.5, width: WALL_THICKNESS, depth: 7 });
  // Gap at z=-13 to z=-11 (door to room 1)
  // From z=-11 to z=-3 (solid)
  walls.push({ x: -2, z: -7, width: WALL_THICKNESS, depth: 8 });
  // Gap at z=-3 to z=-1 (door to room 2)
  // From z=-1 to z=7 (solid)
  walls.push({ x: -2, z: 3, width: WALL_THICKNESS, depth: 8 });
  // Gap at z=7 to z=9 (door to room 3)
  // From z=9 to z=20 (solid)
  walls.push({ x: -2, z: 14.5, width: WALL_THICKNESS, depth: 11 });

  // --- Corridor walls (east side, x = +2) ---
  // From z=-20 to z=-8 (solid)
  walls.push({ x: 2, z: -14, width: WALL_THICKNESS, depth: 12 });
  // Gap at z=-8 to z=-6 (door to room 4)
  // From z=-6 to z=4 (solid)
  walls.push({ x: 2, z: -1, width: WALL_THICKNESS, depth: 10 });
  // Gap at z=4 to z=6 (door to room 5)
  // From z=6 to z=20 (solid)
  walls.push({ x: 2, z: 13, width: WALL_THICKNESS, depth: 14 });

  // --- Room dividing walls (west side) ---

  // Room 1 (south-west): Server Room ~6x8
  // South wall of room 1 is the outer south wall
  // North wall at z=-11 from x=-25 to x=-2
  // But we need a gap... actually no gap needed on the room's north wall
  // since the door is on the corridor side
  walls.push({ x: -13.5, z: -11, width: 23, depth: WALL_THICKNESS });

  // Room 2 (mid-west): Kitchen ~8x6
  // South wall at z=-3 from x=-25 to x=-2 (but we share the wall with room1 at z=-11)
  // Actually room 2 south wall = room 1 north wall (z=-11)? No, let's define rooms:
  // Room 1: x[-25,-2], z[-20,-11] — server room (23 x 9)
  // Room 2: x[-25,-2], z[-3, 7] — kitchen area (23 x 10, a bit big, let's partition)
  // Actually let me make it simpler with an inner divider

  // Room 2 south wall at z=-3
  walls.push({ x: -13.5, z: -3, width: 23, depth: WALL_THICKNESS });

  // Room 2 north wall at z=7
  walls.push({ x: -13.5, z: 7, width: 23, depth: WALL_THICKNESS });

  // Inner partition in west area to split the large middle section
  // Partition at x=-14, from z=-3 to z=7, with a doorway gap at z=1 to z=3
  walls.push({ x: -14, z: -1, width: WALL_THICKNESS, depth: 4 }); // z=-3 to z=1
  walls.push({ x: -14, z: 5, width: WALL_THICKNESS, depth: 4 }); // z=3 to z=7

  // Room 3 area is above z=7 on west side, already enclosed

  // --- Room dividing walls (east side) ---

  // Room 4 (south-east): Meeting Room ~6x6
  // x[2,25], z[-20,-8]
  walls.push({ x: 13.5, z: -8, width: 23, depth: WALL_THICKNESS });

  // Inner partition in room 4 area at x=14, z[-20,-8] with door gap z[-15,-13]
  walls.push({ x: 14, z: -18, width: WALL_THICKNESS, depth: 4 }); // z=-20 to z=-16
  walls.push({ x: 14, z: -11.5, width: WALL_THICKNESS, depth: 7 }); // z=-15 to z=-8

  // Room 5 (north-east): Open Space
  // x[2,25], z[4, 20]
  walls.push({ x: 13.5, z: 4, width: 23, depth: WALL_THICKNESS });

  // Small cubicle divider in open space for gameplay interest
  walls.push({ x: 12, z: 12, width: 6, depth: WALL_THICKNESS });
  walls.push({ x: 18, z: 16, width: WALL_THICKNESS, depth: 6 }); // partial wall

  // Between room 4 and room 5 on the east side (z=-8 to z=4 area)
  // This is a utility/break room - no extra walls needed, just corridor wall + room walls

  return walls;
}

export function createMap(scene: Scene): MapData {
  // --- Floor ---
  const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 40 }, scene);
  ground.position.y = 0;
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.35, 0.35, 0.35);
  ground.material = groundMat;

  // Subtle room floor tints (thin planes slightly above ground)
  const roomFloors: { x: number; z: number; w: number; h: number; color: Color3 }[] = [
    // Server room (blue-gray tint)
    { x: -13.5, z: -15.5, w: 23, h: 9, color: new Color3(0.3, 0.32, 0.38) },
    // Kitchen left (warm tint)
    { x: -19.5, z: 2, w: 11, h: 10, color: new Color3(0.38, 0.35, 0.3) },
    // Kitchen right / copy room
    { x: -8, z: 2, w: 12, h: 10, color: new Color3(0.36, 0.34, 0.32) },
    // Room above kitchen (west north)
    { x: -13.5, z: 13.5, w: 23, h: 13, color: new Color3(0.33, 0.36, 0.33) },
    // Meeting rooms (south-east left)
    { x: 8, z: -14, w: 12, h: 12, color: new Color3(0.38, 0.33, 0.33) },
    // Meeting rooms (south-east right)
    { x: 19.5, z: -14, w: 11, h: 12, color: new Color3(0.35, 0.33, 0.36) },
    // Open space (north-east)
    { x: 13.5, z: 12, w: 23, h: 16, color: new Color3(0.34, 0.34, 0.37) },
    // Corridor
    { x: 0, z: 0, w: 4, h: 40, color: new Color3(0.38, 0.38, 0.38) },
  ];

  for (let i = 0; i < roomFloors.length; i++) {
    const rf = roomFloors[i];
    const plane = MeshBuilder.CreateGround(`floor_${i}`, { width: rf.w, height: rf.h }, scene);
    plane.position = new Vector3(rf.x, 0.01, rf.z);
    const mat = new StandardMaterial(`floorMat_${i}`, scene);
    mat.diffuseColor = rf.color;
    plane.material = mat;
  }

  // --- Walls ---
  const defs = wallDefs();
  const wallMat = new StandardMaterial("wallMat", scene);
  wallMat.diffuseColor = new Color3(0.05, 0.05, 0.05);

  const walls: Mesh[] = [];
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const wall = MeshBuilder.CreateBox(`wall_${i}`, {
      width: d.width,
      height: WALL_HEIGHT,
      depth: d.depth,
    }, scene);
    wall.position = new Vector3(d.x, WALL_HEIGHT / 2, d.z);
    wall.material = wallMat;
    wall.checkCollisions = true;
    walls.push(wall);
  }

  // --- Spawn points (inside rooms and corridor ends) ---
  const spawnPoints: Vector3[] = [
    new Vector3(-13, 0.75, -16),   // Server room
    new Vector3(-18, 0.75, 2),     // Kitchen left
    new Vector3(-7, 0.75, 2),      // Kitchen right
    new Vector3(-13, 0.75, 15),    // NW room
    new Vector3(8, 0.75, -14),     // SE meeting room left
    new Vector3(20, 0.75, -14),    // SE meeting room right
    new Vector3(13, 0.75, 14),     // NE open space
    new Vector3(0, 0.75, 18),      // North corridor end
    new Vector3(0, 0.75, -18),     // South corridor end
  ];

  const playerStart = new Vector3(0, 1.8, 0);

  // Power-up spawn positions (server room, kitchen, corridor north end)
  const powerUpSpawns: Vector3[] = [
    new Vector3(-13, 0, -16),   // Server room
    new Vector3(-18, 0, 2),     // Kitchen left
    new Vector3(13, 0, 14),     // NE open space
  ];

  return { walls, spawnPoints, playerStart, powerUpSpawns };
}

/**
 * Clamp a position so it doesn't overlap any wall bounding box.
 * Uses AABB push-out: find the smallest penetration axis and push out.
 *
 * @param feetY – Y position of the player's feet. Walls whose top is at or
 *   below feetY + stepHeight are walkable surfaces and will be ignored.
 * @param stepHeight – max height the player can step onto without being blocked.
 */
export function clampToMap(
  position: Vector3,
  walls: AbstractMesh[],
  radius: number = 0.4,
  feetY: number = 0,
  stepHeight: number = 0.6,
): Vector3 {
  const result = position.clone();

  for (const wall of walls) {
    const bb = wall.getBoundingInfo().boundingBox;
    const min = bb.minimumWorld;
    const max = bb.maximumWorld;

    // Skip walls whose top is below the player's feet + step tolerance
    // (the player is walking on top of them, not blocked by them)
    if (max.y <= feetY + stepHeight) {
      continue;
    }

    // Skip walls whose bottom is above the player's head (not relevant)
    if (min.y > position.y) {
      continue;
    }

    // Expand the wall AABB by the radius
    const eMinX = min.x - radius;
    const eMaxX = max.x + radius;
    const eMinZ = min.z - radius;
    const eMaxZ = max.z + radius;

    // Check if position is inside expanded AABB (only XZ)
    if (
      result.x > eMinX &&
      result.x < eMaxX &&
      result.z > eMinZ &&
      result.z < eMaxZ
    ) {
      // Find the smallest penetration to push out
      const pushLeft = result.x - eMinX;
      const pushRight = eMaxX - result.x;
      const pushBack = result.z - eMinZ;
      const pushFront = eMaxZ - result.z;

      const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);

      if (minPush === pushLeft) {
        result.x = eMinX;
      } else if (minPush === pushRight) {
        result.x = eMaxX;
      } else if (minPush === pushBack) {
        result.z = eMinZ;
      } else {
        result.z = eMaxZ;
      }
    }
  }

  return result;
}
