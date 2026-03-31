import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/loaders/glTF";

const MAGAZINE_SIZE = 12;

// Idle sway
const SWAY_SPEED = 5;
const SWAY_AMOUNT = 0.003;

// Rest position (bottom-right of view)
const REST_POSITION = new Vector3(0.3, -0.28, 0.6);
const REST_ROTATION = new Vector3(0, Math.PI / 2, 0);

// Scale of the GLB model
const PISTOL_SCALE = 0.05;

export class Weapon {
  private root: TransformNode;
  private scene: Scene;

  private ammo = MAGAZINE_SIZE;
  private maxAmmo = MAGAZINE_SIZE;

  private _isReloading = false;
  private isFiring = false;

  private swayTime = 0;
  private loaded = false;

  private animFire: AnimationGroup | null = null;
  private animReload: AnimationGroup | null = null;
  private animSlide: AnimationGroup | null = null;

  constructor(scene: Scene, camera: UniversalCamera) {
    this.scene = scene;

    // Root node parented to camera
    this.root = new TransformNode("weapon_root", scene);
    this.root.parent = camera;
    this.root.position = REST_POSITION.clone();
    this.root.rotation = REST_ROTATION.clone();

    this.loadModel();
  }

  private async loadModel(): Promise<void> {
    const result = await SceneLoader.ImportMeshAsync("", "/assets/Pistol.glb", "", this.scene);

    // Parent all loaded meshes to our root
    const glbRoot = result.meshes[0];
    glbRoot.parent = this.root;
    glbRoot.scaling.setAll(PISTOL_SCALE);

    // Make all weapon meshes non-pickable (so raycasts ignore them)
    for (const mesh of result.meshes) {
      mesh.isPickable = false;
    }

    // Map animations
    for (const ag of result.animationGroups) {
      const name = ag.name.toLowerCase();
      if (name.includes("fire")) this.animFire = ag;
      else if (name.includes("reload")) this.animReload = ag;
      else if (name.includes("slide")) this.animSlide = ag;

      // Stop all animations initially
      ag.stop();
    }

    // Set up animation end callbacks
    if (this.animFire) {
      this.animFire.onAnimationEndObservable.add(() => {
        this.isFiring = false;
      });
    }

    if (this.animReload) {
      this.animReload.onAnimationEndObservable.add(() => {
        this._isReloading = false;
        this.ammo = this.maxAmmo;
      });
    }

    this.loaded = true;
  }

  /** Attempt to fire. Returns true if a shot was fired. */
  shoot(): boolean {
    if (!this.loaded) return false;
    if (this._isReloading) return false;
    if (this.isFiring) return false;

    if (this.ammo <= 0) {
      this.reload();
      return false;
    }

    this.ammo--;
    this.isFiring = true;

    // Play fire animation
    if (this.animFire) {
      this.animFire.start(false);
    }
    // Play slide animation on top
    if (this.animSlide) {
      this.animSlide.start(false);
    }

    return true;
  }

  /** Start reloading. */
  reload(): void {
    if (!this.loaded) return;
    if (this._isReloading) return;
    if (this.ammo >= this.maxAmmo) return;

    this._isReloading = true;
    this.isFiring = false;

    if (this.animReload) {
      this.animReload.start(false);
    }
  }

  /** Called each frame. */
  update(dt: number, isMoving: boolean): void {
    if (!this.loaded) return;

    // Skip sway during fire/reload animations
    if (this._isReloading || this.isFiring) return;

    // --- Idle sway ---
    if (isMoving) {
      this.swayTime += dt * 0.001 * SWAY_SPEED;
      const swayX = Math.sin(this.swayTime * 2) * SWAY_AMOUNT;
      const swayY = Math.cos(this.swayTime * 4) * SWAY_AMOUNT * 0.5;
      this.root.position.x = REST_POSITION.x + swayX;
      this.root.position.y = REST_POSITION.y + swayY;
    } else {
      // Gently return to rest (frame-rate independent)
      const t = 1 - Math.pow(0.001, dt * 0.001);
      this.root.position.x += (REST_POSITION.x - this.root.position.x) * t;
      this.root.position.y += (REST_POSITION.y - this.root.position.y) * t;
    }
  }

  getAmmo(): { current: number; max: number } {
    return { current: this.ammo, max: this.maxAmmo };
  }

  isReloading(): boolean {
    return this._isReloading;
  }
}
