import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { createMap, MapData } from "./map";

export function createScene(engine: Engine): { scene: Scene; mapData: MapData } {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.15, 0.15, 0.15, 1);

  new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  const mapData = createMap(scene);

  return { scene, mapData };
}
