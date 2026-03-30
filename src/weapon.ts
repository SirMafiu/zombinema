import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";

const MAGAZINE_SIZE = 12;
const RELOAD_DURATION_MS = 1500;

// Recoil animation
const RECOIL_DURATION_MS = 150;
const RECOIL_PITCH = 0.08; // radians kick up
const RECOIL_BACK = 0.04; // units kick back

// Idle sway
const SWAY_SPEED = 5;
const SWAY_AMOUNT = 0.003;

// Rest position (bottom-right of view)
const REST_POSITION = new Vector3(0.3, -0.28, 0.6);
const REST_ROTATION = new Vector3(0, Math.PI, 0.1);

// Reload dip
const RELOAD_DIP = 0.35;

export class Weapon {
  private root: TransformNode;
  private scene: Scene;

  private ammo = MAGAZINE_SIZE;
  private maxAmmo = MAGAZINE_SIZE;

  private _isReloading = false;
  private reloadElapsed = 0;

  private recoilElapsed = RECOIL_DURATION_MS; // start finished
  private isRecoiling = false;

  private swayTime = 0;

  constructor(scene: Scene, camera: UniversalCamera) {
    this.scene = scene;

    // Root node parented to camera
    this.root = new TransformNode("weapon_root", scene);
    this.root.parent = camera;
    this.root.position = REST_POSITION.clone();
    this.root.rotation = REST_ROTATION.clone();

    this.buildModel(scene);
  }

  private buildModel(scene: Scene): void {
    const darkGray = new StandardMaterial("weapon_dark", scene);
    darkGray.diffuseColor = new Color3(0.2, 0.2, 0.2);
    darkGray.specularColor = new Color3(0.3, 0.3, 0.3);

    const lightGray = new StandardMaterial("weapon_light", scene);
    lightGray.diffuseColor = new Color3(0.45, 0.45, 0.45);
    lightGray.specularColor = new Color3(0.4, 0.4, 0.4);

    // Barrel (horizontal cylinder along Z)
    const barrel = MeshBuilder.CreateCylinder(
      "weapon_barrel",
      { height: 0.28, diameter: 0.04, tessellation: 8 },
      scene
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position = new Vector3(0, 0, 0.14);
    barrel.material = darkGray;
    barrel.parent = this.root;
    barrel.isPickable = false;

    // Grip (vertical box)
    const grip = MeshBuilder.CreateBox(
      "weapon_grip",
      { width: 0.04, height: 0.14, depth: 0.06 },
      scene
    );
    grip.position = new Vector3(0, -0.08, -0.01);
    grip.rotation.x = 0.15; // slight angle
    grip.material = darkGray;
    grip.parent = this.root;
    grip.isPickable = false;

    // Slide / body (box on top of barrel area)
    const slide = MeshBuilder.CreateBox(
      "weapon_slide",
      { width: 0.045, height: 0.05, depth: 0.22 },
      scene
    );
    slide.position = new Vector3(0, 0.015, 0.08);
    slide.material = darkGray;
    slide.parent = this.root;
    slide.isPickable = false;

    // Muzzle tip
    const muzzle = MeshBuilder.CreateCylinder(
      "weapon_muzzle",
      { height: 0.03, diameter: 0.035, tessellation: 8 },
      scene
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position = new Vector3(0, 0, 0.295);
    muzzle.material = lightGray;
    muzzle.parent = this.root;
    muzzle.isPickable = false;

    // Trigger guard (small box)
    const triggerGuard = MeshBuilder.CreateBox(
      "weapon_trigger_guard",
      { width: 0.035, height: 0.015, depth: 0.06 },
      scene
    );
    triggerGuard.position = new Vector3(0, -0.025, 0.01);
    triggerGuard.material = lightGray;
    triggerGuard.parent = this.root;
    triggerGuard.isPickable = false;
  }

  /** Attempt to fire. Returns true if a shot was fired. */
  shoot(): boolean {
    if (this._isReloading) return false;

    if (this.ammo <= 0) {
      this.reload();
      return false;
    }

    this.ammo--;
    this.isRecoiling = true;
    this.recoilElapsed = 0;
    return true;
  }

  /** Start reloading. */
  reload(): void {
    if (this._isReloading) return;
    if (this.ammo >= this.maxAmmo) return;

    this._isReloading = true;
    this.reloadElapsed = 0;
  }

  /** Called each frame. */
  update(dt: number, isMoving: boolean): void {
    // --- Reload animation ---
    if (this._isReloading) {
      this.reloadElapsed += dt;

      // Normalized progress [0..1]
      const t = Math.min(this.reloadElapsed / RELOAD_DURATION_MS, 1);
      // Dip down then come back up: sin curve
      const dip = Math.sin(t * Math.PI) * RELOAD_DIP;
      this.root.position.y = REST_POSITION.y - dip;

      if (t >= 1) {
        this._isReloading = false;
        this.ammo = this.maxAmmo;
        this.root.position.y = REST_POSITION.y;
      }
      return; // skip other animations during reload
    }

    // --- Recoil animation ---
    if (this.isRecoiling) {
      this.recoilElapsed += dt;
      const t = Math.min(this.recoilElapsed / RECOIL_DURATION_MS, 1);

      // Quick kick then return: 1 - t for linear falloff
      const intensity = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;

      this.root.rotation.x = REST_ROTATION.x - RECOIL_PITCH * intensity;
      this.root.position.z = REST_POSITION.z - RECOIL_BACK * intensity;

      if (t >= 1) {
        this.isRecoiling = false;
        this.root.rotation.x = REST_ROTATION.x;
        this.root.position.z = REST_POSITION.z;
      }
    } else {
      this.root.rotation.x = REST_ROTATION.x;
      this.root.position.z = REST_POSITION.z;
    }

    // --- Idle sway ---
    if (isMoving) {
      this.swayTime += dt * 0.001 * SWAY_SPEED;
      const swayX = Math.sin(this.swayTime * 2) * SWAY_AMOUNT;
      const swayY = Math.cos(this.swayTime * 4) * SWAY_AMOUNT * 0.5;
      this.root.position.x = REST_POSITION.x + swayX;
      this.root.position.y = REST_POSITION.y + swayY;
    } else {
      // Gently return to rest
      this.root.position.x += (REST_POSITION.x - this.root.position.x) * 0.1;
      if (!this._isReloading) {
        this.root.position.y += (REST_POSITION.y - this.root.position.y) * 0.1;
      }
    }
  }

  getAmmo(): { current: number; max: number } {
    return { current: this.ammo, max: this.maxAmmo };
  }

  isReloading(): boolean {
    return this._isReloading;
  }
}
