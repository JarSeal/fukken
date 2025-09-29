import * as THREE from 'three/webgpu';
import { PhysicsObject } from '../_engine/core/PhysicsRapier';
import { range, texture, mix, uv, color, rotateUV, positionLocal, time, uniform } from 'three/tsl';
import { createSceneMainLooper, getCurrentScene } from '../_engine/core/Scene';
import { getTexture } from '../_engine/core/Texture';
import { deleteKeyInputControl } from '../_engine/core/InputControls';
import { getCharacter } from '../_engine/core/Character';
import { CMP } from '../_engine/utils/CMP';
import { getHUDRootCMP } from '../_engine/core/HUD';
import { getCurrentCamera } from '../_engine/core/Camera';

let smokeInstancedSprite: THREE.Mesh | null = null;
const fireYOffset = 0.7;

const fireAndSmoke = (pos: THREE.Vector3) => {
  const map = getTexture('smokeTexture');
  if (!map) return;

  const scene = getCurrentScene();
  if (!scene) return;

  const lifeRange = range(0, 1);
  const offsetRange = range(new THREE.Vector3(-1, 3, -1), new THREE.Vector3(1, 5, 1));

  const speed = uniform(0.2);
  // const scaledTime = time.add(0.1).mul(speed);
  const scaledTime = time.mul(speed);

  const lifeTime = scaledTime.mul(lifeRange).mod(1);
  const scaleRange = range(0.3, 2);
  const rotateRange = range(0.1, 4);

  const life = lifeTime.div(lifeRange);

  const fakeLightEffect = positionLocal.y.oneMinus().max(0.2);

  const textureNode = texture(map, rotateUV(uv(), scaledTime.mul(rotateRange)));

  const opacityNode = textureNode.a.mul(life.oneMinus());

  const smokeColor = mix(color(0x2c1501), color(0x222222), positionLocal.y.mul(3).clamp());

  // create particles

  const smokeNodeMaterial = new THREE.SpriteNodeMaterial();
  smokeNodeMaterial.colorNode = mix(color(0xf27d0c), smokeColor, life.mul(2.5).min(1)).mul(
    fakeLightEffect
  );
  smokeNodeMaterial.opacityNode = opacityNode;
  smokeNodeMaterial.positionNode = offsetRange.mul(lifeTime);
  smokeNodeMaterial.scaleNode = scaleRange.mul(lifeTime.max(0.3));
  smokeNodeMaterial.depthWrite = false;

  smokeInstancedSprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smokeNodeMaterial);
  smokeInstancedSprite.scale.setScalar(1);
  smokeInstancedSprite.count = 2000;
  smokeInstancedSprite.position.set(pos.x, pos.y + fireYOffset, pos.z);
  scene.add(smokeInstancedSprite);

  //

  const fireGeometry = new THREE.PlaneGeometry(1, 1);
  const fireCount = 1000;

  const fireNodeMaterial = new THREE.SpriteNodeMaterial();
  fireNodeMaterial.colorNode = mix(color(0xb72f17), color(0xb72f17), life);
  fireNodeMaterial.positionNode = range(
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, 2, 1)
  ).mul(lifeTime);
  fireNodeMaterial.scaleNode = smokeNodeMaterial.scaleNode;
  fireNodeMaterial.opacityNode = opacityNode.mul(0.5);
  fireNodeMaterial.blending = THREE.AdditiveBlending;
  fireNodeMaterial.transparent = true;
  fireNodeMaterial.depthWrite = false;

  // indirect draw ( optional )
  // each indirect draw call is 5 uint32 values for indexes ( different structure for non-indexed draw calls using 4 uint32 values )

  const indexCount = fireGeometry.index?.array.length || 0;

  const uint32 = new Uint32Array(5);
  uint32[0] = indexCount; // indexCount
  uint32[1] = fireCount; // instanceCount
  uint32[2] = 0; // firstIndex
  uint32[3] = 0; // baseVertex
  uint32[4] = 0; // firstInstance

  const indirectAttribute = new THREE.IndirectStorageBufferAttribute(uint32, 5);
  fireGeometry.setIndirect(indirectAttribute);
};

const waitForWinScreen = 2000; // In ms

export const deathAnim = (obj: PhysicsObject) => {
  // Explode
  if (obj.mesh?.position) {
    fireAndSmoke(obj.mesh?.position);
    const startTime = performance.now();
    createSceneMainLooper(() => {
      if (obj.mesh && smokeInstancedSprite) {
        smokeInstancedSprite.position.copy(obj.mesh.position);
        smokeInstancedSprite.position.y = smokeInstancedSprite.position.y + fireYOffset;
      }
      const elapsed = performance.now() - startTime;
      if (elapsed < waitForWinScreen) {
        const multiplier = elapsed / 2000;
        const pos =
          obj.mesh?.position || smokeInstancedSprite?.position || new THREE.Vector3(0, 0, 0);
        getCurrentCamera()?.lookAt(
          new THREE.Vector3(pos.x * multiplier, pos.y * multiplier, pos.z * multiplier)
        );
      }
    });
  }
  const deadChar = getCharacter(obj.id);
  for (let i = 0; i < deadChar.keyControlIds.length; i++) {
    deleteKeyInputControl({ id: deadChar.keyControlIds[i] });
  }
};

let winAnimInitated = false;
export const winAnim = (dyingNumber: string) => {
  if (winAnimInitated) return;
  winAnimInitated = true;
  const winner = dyingNumber === '1' ? '2' : '1';
  setTimeout(() => {
    const cmp = getHUDRootCMP().add(
      CMP({
        id: 'winner-found-cmp',
        text: '',
        style: {
          width: '100vw',
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pointerEvents: 'none',
        },
      })
    );
    cmp.add({
      id: 'winner-found-text-cmp',
      text: `WINNER IS POTATO ${winner} (hit space to restart)`,
      style: {
        padding: '20px 30px',
        margin: '30px',
        transform: 'translateY(120%)',
        background: 'white',
        borderRadius: '5px',
        opacity: 0.8,
      },
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') {
        location.reload();
      }
    });
  }, waitForWinScreen);
};
