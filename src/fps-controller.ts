import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { clampToMap } from "./map";

const MOVE_SPEED = 10;
const SPRINT_MULTIPLIER = 1.8;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = (85 * Math.PI) / 180;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.4;
const JUMP_FORCE = 6;
const GRAVITY = 15;

export function setupFpsController(
  scene: Scene,
  canvas: HTMLCanvasElement,
  playerStart: Vector3,
  walls: Mesh[],
): UniversalCamera {
  const camera = new UniversalCamera("fps", playerStart.clone(), scene);
  camera.setTarget(playerStart.add(new Vector3(0, 0, 1)));
  camera.minZ = 0.1;

  // Disable default camera inputs — we handle everything manually
  camera.inputs.clear();

  const instructions = document.getElementById("instructions")!;
  let locked = false;

  canvas.addEventListener("click", () => {
    if (!locked) {
      canvas.requestPointerLock();
    }
  });

  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    instructions.style.display = locked ? "none" : "block";
  });

  // Mouse look
  document.addEventListener("mousemove", (e) => {
    if (!locked) return;
    camera.rotation.y += e.movementX * MOUSE_SENSITIVITY;
    camera.rotation.x += e.movementY * MOUSE_SENSITIVITY;
    camera.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, camera.rotation.x));
  });

  // WASD movement
  const keys = new Set<string>();

  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));

  let velocityY = 0;
  let onGround = true;

  scene.onBeforeRenderObservable.add(() => {
    if (!locked) return;

    const dt = scene.getEngine().getDeltaTime() / 1000;
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = MOVE_SPEED * (sprinting ? SPRINT_MULTIPLIER : 1) * dt;

    // Jump
    if (keys.has("Space") && onGround) {
      velocityY = JUMP_FORCE;
      onGround = false;
    }

    const forward = camera.getDirection(Vector3.Forward());
    forward.y = 0;
    forward.normalize();

    const right = camera.getDirection(Vector3.Right());
    right.y = 0;
    right.normalize();

    const move = Vector3.Zero();

    if (keys.has("KeyW") || keys.has("KeyZ")) move.addInPlace(forward);
    if (keys.has("KeyS")) move.subtractInPlace(forward);
    if (keys.has("KeyD")) move.addInPlace(right);
    if (keys.has("KeyA") || keys.has("KeyQ")) move.subtractInPlace(right);

    if (move.lengthSquared() > 0) {
      move.normalize().scaleInPlace(speed);
      camera.position.addInPlace(move);
    }

    // Clamp position against walls
    const clamped = clampToMap(camera.position, walls, PLAYER_RADIUS);
    camera.position.x = clamped.x;
    camera.position.z = clamped.z;

    // Vertical movement (gravity + jump)
    velocityY -= GRAVITY * dt;
    camera.position.y += velocityY * dt;

    if (camera.position.y <= PLAYER_HEIGHT) {
      camera.position.y = PLAYER_HEIGHT;
      velocityY = 0;
      onGround = true;
    }
  });

  return camera;
}
