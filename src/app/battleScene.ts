import * as THREE from 'three/webgpu';
import { createScene } from '../_engine/core/Scene';
import { createLight } from '../_engine/core/Light';
import { createSkyBox } from '../_engine/core/SkyBox';
import { getCamera, setCurrentCamera } from '../_engine/core/Camera';
import { getLoaderStatusUpdater } from '../_engine/core/SceneLoader';
import { MAIN_APP_CAM_ID } from '../CONFIG';
import { createPhysicsObjectWithMesh, getPhysicsObject } from '../_engine/core/PhysicsRapier';
import { createMaterial } from '../_engine/core/Material';
import { createMesh } from '../_engine/core/Mesh';
import { createGeometry } from '../_engine/core/Geometry';
import { createFighterCharacter } from './battleCharacter';

export const BATTLE_SCENE_ID = 'battleScene';

export const battleScene = async () =>
  new Promise<string>(async (resolve) => {
    const updateLoaderFn = getLoaderStatusUpdater();
    updateLoaderFn({ loadedCount: 0, totalCount: 2 });

    // Set current camera and position it
    const camera = getCamera(MAIN_APP_CAM_ID);
    setCurrentCamera(MAIN_APP_CAM_ID);
    camera.position.z = -15;
    camera.position.x = 0;
    camera.position.y = 1.5;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const scene = createScene(BATTLE_SCENE_ID, {
      name: 'Start scene',
      isCurrentScene: true,
    });

    updateLoaderFn({ loadedCount: 1, totalCount: 2 });

    await createSkyBox({
      id: 'emptyBlueSkyEquiRect',
      name: 'Empty Blue Sky EquiRect',
      type: 'EQUIRECTANGULAR',
      params: {
        file: '/debugger/assets/testTextures/skyboxes/sunset_stylized/sky_empty_2k.png',
        textureId: 'equiRectEmptyId',
        colorSpace: THREE.SRGBColorSpace,
        // colorSpace: THREE.LinearSRGBColorSpace,
        // colorSpace: THREE.NoColorSpace,
      },
    });

    // Batch load textures example
    // const updateLoadStatusFn = (
    //   loadedTextures: { [id: string]: THREE.Texture },
    //   loadedCount: number,
    //   totalCount: number
    // ) => {
    //   if (totalCount === 0) llog(`Loaded textures: ${loadedCount}/${totalCount}`, loadedTextures);
    // };
    // loadTextures(
    //   [
    //     { fileName: '/debugger/assets/testTextures/Poliigon_MetalRust_7642_BaseColor.jpg' },
    //     { fileName: '/debugger/assets/testTextures/Poliigon_MetalRust_7642_AmbientOcclusion.jpg' },
    //     { fileName: '/debugger/assets/testTextures/Poliigon_MetalRust_7642_Metallic.jpg' },
    //   ],
    //   updateLoadStatusFn
    // );

    // Lights
    const ambient = createLight({
      id: 'ambientLight',
      name: 'Ambient light',
      type: 'AMBIENT',
      params: { color: '#ffffff', intensity: 0.5 },
    });
    scene.add(ambient);

    const hemisphere = createLight({
      id: 'hemisphereLight',
      type: 'HEMISPHERE',
      params: {
        skyColor: 0x220000,
        groundColor: 0x225599,
        intensity: 1.5,
      },
    });
    scene.add(hemisphere);

    const directionalLight = createLight({
      id: 'directionalLight',
      type: 'DIRECTIONAL',
      params: {
        position: { x: -5, y: 2.5, z: 2.5 },
        color: 0xffe5c7,
        // intensity: Math.PI,
        intensity: 5,
        castShadow: true,
        shadowMapSize: [2048, 2048],
        shadowCamNearFar: [1, 15],
        shadowCamLeftRightTopBottom: [-10, 10, 10, -10],
        shadowBias: 0,
        shadowNormalBias: 0,
        shadowRadius: 5, // Not for PCFSoftShadowMap type
        shadowBlurSamples: 10, // Only for VSM shadowmap types
        shadowIntensity: 0.75,
      },
    });
    scene.add(directionalLight);

    // Create main platform
    const groundWidth = 20;
    const groundDepth = 5;
    const groundHeight = 0.5;
    const groundPos = { x: 0, y: 0, z: 0 };
    const groundGeo = createGeometry({
      id: 'battleGround',
      type: 'BOX',
      params: { width: groundWidth, height: groundHeight, depth: groundDepth },
    });
    const groundMat = createMaterial({
      id: 'battleGround',
      type: 'LAMBERT',
      params: { color: 0x556334 },
    });
    const groundMesh = createMesh({
      id: 'battleGroundMesh',
      geo: groundGeo,
      mat: groundMat,
      receiveShadow: true,
      castShadow: true,
    });
    groundMesh.position.set(groundPos.x, groundPos.y, groundPos.z);
    createPhysicsObjectWithMesh({
      physicsParams: {
        collider: {
          type: 'BOX',
          hx: groundWidth / 2,
          hy: groundHeight / 2,
          hz: groundDepth / 2,
          friction: 0,
        },
        rigidBody: { rigidType: 'FIXED', translation: groundPos },
      },
      meshOrMeshId: groundMesh,
    });
    scene.add(groundMesh);

    // Add battle character 1
    const { charMesh: charMesh1, fighterCharacterObject: fighterCharacterObject1 } =
      createFighterCharacter(1, {
        _keys: {
          moveLeft: ['a', 'A'],
          moveRight: ['d', 'D'],
          jump: ['w', 'W'],
        },
      });
    const charPhysObj1 = getPhysicsObject(fighterCharacterObject1.physObjectId);
    charPhysObj1?.setTranslation({ x: 8, y: 5, z: 0 });
    scene.add(charMesh1);

    // Add battle character 2
    const { charMesh: charMesh2, fighterCharacterObject: fighterCharacterObject2 } =
      createFighterCharacter(2, {
        _keys: {
          moveLeft: 'ArrowLeft',
          moveRight: 'ArrowRight',
          jump: 'ArrowUp',
        },
      });
    const charPhysObj2 = getPhysicsObject(fighterCharacterObject2.physObjectId);
    charPhysObj2?.setTranslation({ x: -8, y: 5, z: 0 });
    scene.add(charMesh2);

    updateLoaderFn({ loadedCount: 2, totalCount: 2 });

    resolve(BATTLE_SCENE_ID);
  });
