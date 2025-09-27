import * as THREE from 'three/webgpu';
import { createScene } from '../_engine/core/Scene';
import { createLight } from '../_engine/core/Light';
import { createSkyBox } from '../_engine/core/SkyBox';
import { getCamera, setCurrentCamera } from '../_engine/core/Camera';
import { getLoaderStatusUpdater, loadScene } from '../_engine/core/SceneLoader';
import { MAIN_APP_CAM_ID } from '../CONFIG';
import { importModelAsync } from '../_engine/core/ImportModel';
import { createPhysicsObjectWithMesh } from '../_engine/core/PhysicsRapier';
import { createMaterial } from '../_engine/core/Material';
import { createMesh } from '../_engine/core/Mesh';
import { createGeometry } from '../_engine/core/Geometry';
import { battleScene } from './battleScene';

export const START_SCENE_ID = 'startScene';

export const startScene = async () =>
  new Promise<string>(async (resolve) => {
    const updateLoaderFn = getLoaderStatusUpdater();
    updateLoaderFn({ loadedCount: 0, totalCount: 2 });

    // Set current camera and position it
    const camera = getCamera(MAIN_APP_CAM_ID);
    setCurrentCamera(MAIN_APP_CAM_ID);
    camera.position.z = 0.2;
    camera.position.x = 0.4;
    camera.position.y = 4;
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const scene = createScene(START_SCENE_ID, {
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

    // Create ground
    const groundWidthAndDepth = 10;
    const groundHeight = 0.2;
    const groundPos = { x: 0, y: -2, z: 0 };
    const groundGeo = createGeometry({
      id: 'ground',
      type: 'BOX',
      params: { width: groundWidthAndDepth, height: groundHeight, depth: groundWidthAndDepth },
    });
    const groundMat = createMaterial({
      id: 'ground',
      type: 'LAMBERT',
      params: { color: 0x556334 },
    });
    const groundMesh = createMesh({
      id: 'groundMesh',
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
          hx: groundWidthAndDepth / 2,
          hy: groundHeight / 2,
          hz: groundWidthAndDepth / 2,
          friction: 0,
        },
        rigidBody: { rigidType: 'FIXED', translation: groundPos },
      },
      meshOrMeshId: groundMesh,
    });
    scene.add(groundMesh);

    // Create logo
    const logo = await importModelAsync<THREE.Mesh>({
      id: 'importedMesh1',
      fileName: '/models/logo.glb',
      throwOnError: true,
    });
    if (logo) {
      logo.receiveShadow = true;
      logo.castShadow = true;
      createPhysicsObjectWithMesh({
        physicsParams: {
          collider: { type: 'TRIMESH' },
          rigidBody: {
            rigidType: 'DYNAMIC',
            translation: { x: 0, y: 3, z: 0 },
            angvel: { x: 3, y: 1, z: 5 },
            ccdEnabled: true,
          },
        },
        meshOrMeshId: logo,
      });
      const material = createMaterial({
        id: 'importedBox01Material',
        type: 'PHONG',
        params: {
          color: 'red',
        },
      });
      logo.position.set(0, 0, 0);
      logo.material = material;
      scene.add(logo);
    }

    updateLoaderFn({ loadedCount: 2, totalCount: 2 });

    const startBattleFn = (e: KeyboardEvent) => {
      console.log(e.key);
      if (e.key === ' ') {
        // Load scene
        loadScene({ nextSceneFn: battleScene });
        document.removeEventListener('keyup', startBattleFn);
      }
    };
    document.addEventListener('keyup', startBattleFn);

    resolve(START_SCENE_ID);
  });
