import * as THREE from 'three/webgpu';
import { createGeometry } from '../_engine/core/Geometry';
import { createMaterial } from '../_engine/core/Material';
import { loadTexture } from '../_engine/core/Texture';
import { createMesh, getMesh } from '../_engine/core/Mesh';
import { CharacterObject, createCharacter } from '../_engine/core/Character';
import { transformAppSpeedValue } from '../_engine/core/MainLoop';
import {
  createPhysicsObjectWithoutMesh,
  deletePhysicsObject,
  getPhysicsObject,
  PhysicsObject,
} from '../_engine/core/PhysicsRapier';
import { createSceneAppLooper, getRootScene } from '../_engine/core/Scene';
import { castRayFromPoints } from '../_engine/core/Raycast';
import { createGroup } from '../_engine/core/Group';

// @TODO: add comments for each
// If a prop has one underscore (_) then it means it is a configuration,
// if a prop has two underscores (__) then it means it is a memory slot for data (not configurable)
export type CharacterData = {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number; world: number };
  charRotation: number;
  isMoving: boolean;
  isGrounded: boolean;
  isFalling: boolean;
  isRunning: boolean;
  isCrouching: boolean; // @TODO: add physics object switching (several physic objects)
  isDirectionLeft: boolean;
  _keys: {
    moveLeft: string | string[];
    moveRight: string | string[];
    jump: string | string[];
    hit: string | string[];
  };
  _height: number;
  _radius: number;
  _rotateSpeed: number;
  _maxVelocity: number;
  _jumpAmount: number;
  _inTheAirDiminisher: number;
  _linearVelocityInterval: number;
  _accumulateVeloPerInterval: number;
  _groundedRayMaxDistance: number;
  /** How much time is there when the character is not touching the ground and goes into the "isFalling" state (in milliseconds) */
  _isFallingThreshold: number;
  _runningMultiplier: number;
  _crouchingMultiplier: number;
  __isFallingStartTime: number;
  __lviCheckTime: number;
  __jumpTime: number;
};

const DEFAULT_CHARACTER_DATA: CharacterData = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0, world: 0 },
  charRotation: 0,
  isMoving: false,
  isGrounded: false,
  isFalling: false,
  isRunning: false,
  isCrouching: false,
  isDirectionLeft: false,
  _keys: {
    moveLeft: ['a', 'A'],
    moveRight: ['d', 'D'],
    jump: ' ',
    hit: ['s', 'S'],
  },
  _height: 1.74,
  _radius: 0.5,
  _rotateSpeed: 5,
  _maxVelocity: 3.7,
  _jumpAmount: 8,
  _inTheAirDiminisher: 0.2,
  _linearVelocityInterval: 10,
  _accumulateVeloPerInterval: 80,
  _groundedRayMaxDistance: 1.2,
  _isFallingThreshold: 1200,
  _runningMultiplier: 1.85,
  _crouchingMultiplier: 0.65,
  __isFallingStartTime: 0,
  __lviCheckTime: 0,
  __jumpTime: 0,
};

const fighterCharacterObject: CharacterObject[] = [];

export const createFighterCharacter = (index: number, charData?: Partial<CharacterData>) => {
  // Combine character data
  const characterData = { ...DEFAULT_CHARACTER_DATA, ...charData };

  const CHARACTER_ID = 'fighterCharacter-' + index;

  const charCapsule = createGeometry({
    id: 'charCapsuleFighter' + index,
    type: 'CAPSULE',
    params: { radius: characterData._radius, height: characterData._height / 3 },
  });
  const charMaterial = createMaterial({
    id: 'box1MaterialFighter' + index,
    type: 'PHONG',
    params: {
      map: loadTexture({
        id: 'box1Texture',
        fileName: '/debugger/assets/testTextures/Poliigon_MetalRust_7642_BaseColor.jpg',
      }),
    },
  });
  const charMesh = createMesh({
    id: 'charMeshFighter' + index,
    geo: charCapsule,
    mat: charMaterial,
  });
  charMesh.position.set(0, 0, 0);
  charMesh.rotation.set(0, 0, 0);

  const leftArm = getMesh('leftArm')?.clone();
  const leftArmGroup = createGroup({ id: 'leftArmGroup' + index });
  const rightArm = getMesh('rightArm')?.clone();
  const rightArmGroup = createGroup({ id: 'rightArmGroup' + index });
  const scale = 0.12;
  if (leftArm) {
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    leftArm.scale.set(scale, scale, scale);
    leftArmGroup.add(leftArm);
    leftArm.position.set(0, 0, -characterData._radius + 0.05);
  }
  if (rightArm) {
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    rightArm.scale.set(scale, scale, scale);
    rightArmGroup.add(rightArm);
    rightArm.position.set(0, 0, characterData._radius + 0.05);
  }
  charMesh.add(leftArmGroup);
  charMesh.add(rightArmGroup);

  let hitObj: PhysicsObject | null = null;

  const directionBeakMesh = createMesh({
    id: 'directionBeakMeshFighter' + index,
    geo: createGeometry({
      id: 'directionBeakGeoFighter',
      type: 'BOX',
      params: { width: 0.25, height: 0.25, depth: 0.7 },
    }),
    mat: createMaterial({
      id: 'directionBeakMatFighter',
      type: 'BASIC',
      params: { color: '#333' },
    }),
  });
  directionBeakMesh.position.set(0.35, 0.43, 0);
  charMesh.add(directionBeakMesh);
  const charObj = createCharacter({
    id: CHARACTER_ID,
    physicsParams: [
      {
        collider: {
          type: 'CAPSULE',
          friction: 1,
        },
        rigidBody: {
          rigidType: 'DYNAMIC',
          lockRotations: { x: true, y: true, z: true },
          linearDamping: 0,
        },
      },
      {
        collider: {
          type: 'CAPSULE',
          friction: 1.5,
          halfHeight: charCapsule.userData.props?.params.height / 4,
          translation: {
            x: charMesh.position.x,
            y: charMesh.position.y - charCapsule.userData.props?.params.height / 4,
            z: charMesh.position.z,
          },
        },
      },
      // {
      //   collider: {
      //     type: 'CAPSULE',
      //     halfHeight: (charCapsule.userData.props?.params.height / 2.5) * 1.05,
      //     radius: charCapsule.userData.props?.params.radius * 1.05,
      //     isSensor: true,
      //     density: 0,
      //     collisionEventFn: (obj1, obj2, started) => {
      //       console.log('SENSOR ALERT', obj1, obj2, started);
      //       if (started) {
      //         //
      //       } else {
      //         //
      //       }
      //     },
      //     translation: { x: 0, y: 0.05, z: 0 },
      //   },
      // },
    ],
    data: characterData,
    meshOrMeshId: charMesh,
    controls: [
      {
        id: 'charMoveLeft' + index,
        key: characterData._keys.moveLeft,
        type: 'KEY_LOOP_ACTION',
        fn: (_, __, data) => {
          const mesh = data?.mesh as THREE.Mesh;
          const charObj = data?.charObject as CharacterObject;
          const charData = charObj.data as CharacterData;
          charData.isDirectionLeft = true;

          if (!mesh || !charData) return;

          // Turn left
          const axis = new THREE.Vector3(0, 1, 0);
          axis.normalize();
          const angleInRadians = 0;
          const quaternion = new THREE.Quaternion();
          quaternion.setFromAxisAngle(axis, angleInRadians);
          mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

          // Forward and backward
          const intervalCheckOk =
            charData?._linearVelocityInterval === 0 ||
            (charData?.__lviCheckTime || 0) + (charData?._linearVelocityInterval || 0) <
              performance.now();
          const physObj = data?.physObj as PhysicsObject;
          const rigidBody = physObj.rigidBody;
          if (intervalCheckOk && physObj.rigidBody && rigidBody) {
            const inTheAirDiminisher =
              characterData.isGrounded && !characterData.isFalling
                ? 1
                : characterData._inTheAirDiminisher;
            const veloAccu = transformAppSpeedValue(
              characterData._accumulateVeloPerInterval * inTheAirDiminisher
            );
            const maxVelo = characterData._maxVelocity;
            const mainDirection = 1;
            const xVelo = veloAccu * mainDirection;
            const xMaxVelo = maxVelo * mainDirection;
            const xAddition =
              xVelo > 0
                ? Math.min((rigidBody.linvel()?.x || 0) + xVelo, xMaxVelo)
                : Math.max((rigidBody.linvel()?.x || 0) + xVelo, xMaxVelo);
            // @TODO: character gets stuck on walls, add detection and correct the linear velocity direction to the direction of the wall (or cancel it if head on collision)
            const vector3 = new THREE.Vector3(xAddition, rigidBody.linvel()?.y || 0, 0);
            rigidBody.setLinvel(vector3, !rigidBody.isMoving());
            charData.__lviCheckTime = performance.now();
          }
        },
      },
      {
        id: 'charMoveRight' + index,
        key: characterData._keys.moveRight,
        type: 'KEY_LOOP_ACTION',
        fn: (_, __, data) => {
          const mesh = data?.mesh as THREE.Mesh;
          const charObj = data?.charObject as CharacterObject;
          const charData = charObj.data as CharacterData;
          charData.isDirectionLeft = false;

          if (!mesh || !charData) return;

          // Turn right
          const axis = new THREE.Vector3(0, 1, 0);
          axis.normalize();
          const angleInRadians = Math.PI;
          const quaternion = new THREE.Quaternion();
          quaternion.setFromAxisAngle(axis, angleInRadians);
          mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

          // Forward and backward
          const intervalCheckOk =
            charData?._linearVelocityInterval === 0 ||
            (charData?.__lviCheckTime || 0) + (charData?._linearVelocityInterval || 0) <
              performance.now();
          const physObj = data?.physObj as PhysicsObject;
          const rigidBody = physObj.rigidBody;
          if (intervalCheckOk && physObj.rigidBody && rigidBody) {
            const inTheAirDiminisher =
              characterData.isGrounded && !characterData.isFalling
                ? 1
                : characterData._inTheAirDiminisher;
            const veloAccu = transformAppSpeedValue(
              characterData._accumulateVeloPerInterval * inTheAirDiminisher
            );
            const maxVelo = characterData._maxVelocity;
            const mainDirection = -1;
            const xVelo = veloAccu * mainDirection;
            const xMaxVelo = maxVelo * mainDirection;
            const xAddition =
              xVelo > 0
                ? Math.min((rigidBody.linvel()?.x || 0) + xVelo, xMaxVelo)
                : Math.max((rigidBody.linvel()?.x || 0) + xVelo, xMaxVelo);
            // @TODO: character gets stuck on walls, add detection and correct the linear velocity direction to the direction of the wall (or cancel it if head on collision)
            const vector3 = new THREE.Vector3(xAddition, rigidBody.linvel()?.y || 0, 0);
            rigidBody.setLinvel(vector3, !rigidBody.isMoving());
            charData.__lviCheckTime = performance.now();
          }
        },
      },
      {
        id: 'charJump' + index,
        key: characterData._keys.jump,
        type: 'KEY_DOWN',
        fn: (e, __, data) => {
          e.preventDefault();
          if (e.repeat) return;
          // Jump
          const charObj = data?.charObject as CharacterObject;
          const charData = charObj.data as CharacterData;
          // @TODO: add check if on the ground
          const jumpCheckOk =
            charData.isGrounded &&
            !charData.isCrouching &&
            charData.__jumpTime + 100 < performance.now();
          if (jumpCheckOk) {
            const physObj = data?.physObj as PhysicsObject;
            physObj.rigidBody?.applyImpulse(new THREE.Vector3(0, charData._jumpAmount, 0), true);
            charData.__jumpTime = performance.now();
          }
        },
      },
      {
        id: 'charHit' + index,
        key: characterData._keys.hit,
        type: 'KEY_DOWN',
        fn: (e, __, data) => {
          e.preventDefault();
          if (e.repeat) return;
          // Hit
          const cData = (data?.charObject as CharacterObject)?.data as CharacterData;
          const cMesh = (data?.charObject as CharacterObject)?.meshId
            ? getMesh((data?.charObject as CharacterObject)?.meshId as string)
            : null;
          if (!cMesh) return;
          const pos = cMesh.position;
          if (!pos) return;
          hitObj =
            createPhysicsObjectWithoutMesh({
              id: 'hitSensor' + index,
              physicsParams: {
                collider: {
                  type: 'BOX',
                  hx: 0.2,
                  hy: 0.2,
                  hz: 0.2,
                  isSensor: true,
                  collisionEventFn: (obj1, obj2, started) => {
                    if (!started) return;
                    let obj: PhysicsObject | null = null;
                    if (obj1.id.startsWith('fighterCharacter')) {
                      obj = obj1;
                    } else if (obj2.id.startsWith('fighterCharacter')) {
                      obj = obj2;
                    }
                    if (cData.isDirectionLeft) {
                      obj?.rigidBody?.setLinvel(new THREE.Vector3(10), true);
                    } else {
                      obj?.rigidBody?.setLinvel(new THREE.Vector3(-10), true);
                    }
                  },
                  translation: {
                    x: cData.isDirectionLeft
                      ? pos.x + cData._radius / 2 + 0.8
                      : pos.x - cData._radius / 2 - 0.8,
                    y: pos.y,
                    z: pos.z,
                  },
                },
              },
            }) || null;

          const hitWithLeftHand = Math.random() > 0.5;
          if (hitWithLeftHand) {
            leftArmGroup.rotateZ(-Math.PI / 2);
          } else {
            rightArmGroup.rotateZ(Math.PI / 2);
          }
        },
      },
      {
        id: 'charHitReset' + index,
        key: characterData._keys.hit,
        type: 'KEY_UP',
        fn: () => {
          // Reset Hit
          if (hitObj) deletePhysicsObject(hitObj.id);
          hitObj = null;
          if (leftArmGroup.rotation.z !== 0) {
            leftArmGroup.rotateZ(Math.PI / 2);
          }
          if (rightArmGroup.rotation.z !== 0) {
            rightArmGroup.rotateZ(-Math.PI / 2);
          }
        },
      },
      // {
      //   id: 'charRun',
      //   key: 'Shift',
      //   type: 'KEY_DOWN',
      //   fn: (e, __, data) => {
      //     e.preventDefault();
      //     if (e.repeat) return;
      //     // Set isRunning state
      //     const charObj = data?.charObject as CharacterObject;
      //     const charData = charObj.data as CharacterData;
      //     charData.isRunning = !charData.isRunning;
      //   },
      // },
      // {
      //   id: 'charCrouch',
      //   key: 'Control',
      //   type: 'KEY_DOWN',
      //   fn: (e, __, data) => {
      //     e.preventDefault();
      //     if (e.repeat) return;
      //     // Set isCrouching state
      //     const charObj = data?.charObject as CharacterObject;
      //     const charData = charObj.data as CharacterData;
      //     charData.isCrouching = !charData.isCrouching;
      //     const nextIndex = charData.isCrouching ? 1 : 0;
      //     switchPhysicsCollider(charObj.id, nextIndex);
      //   },
      // },
    ],
  });

  fighterCharacterObject.push(charObj);

  if (charObj.data?.isDirectionLeft) {
    charMesh.rotation.y = 0;
  } else {
    charMesh.rotation.y = Math.PI;
  }

  // Ground detection with rays
  const groundRaycaster = new THREE.Raycaster();
  groundRaycaster.near = 0.01;
  groundRaycaster.far = 10;
  const usableVec = new THREE.Vector3();
  const groundRaycastVecDir = new THREE.Vector3(0, -1, 0).normalize();
  const charHalfRadius = characterData._radius / 2;
  const detectGround = () => {
    characterData.isGrounded = false;

    // First ray from the middle of the character
    castRayFromPoints<THREE.Mesh>(
      getRootScene()?.children || [],
      charMesh.position,
      groundRaycastVecDir,
      {
        // helperId: 'middleGroundDetector',
        startLength: characterData._height / 3,
        endLength: characterData._groundedRayMaxDistance,
        perIntersectFn: (intersect) => {
          if (intersect.object.userData.isPhysicsObject) {
            characterData.isGrounded = true;
            return true;
          }
        },
      }
    );
    if (characterData.isGrounded) return;

    // Four rays from the edges of the character
    castRayFromPoints<THREE.Mesh>(
      getRootScene()?.children || [],
      charMesh.position.clone().sub({ x: charHalfRadius, y: 0, z: 0 }),
      groundRaycastVecDir,
      {
        // helperId: 'off1GroundDetector',
        startLength: characterData._height / 3,
        endLength: characterData._groundedRayMaxDistance,
        perIntersectFn: (intersect) => {
          if (intersect.object.userData.isPhysicsObject) {
            characterData.isGrounded = true;
            return true;
          }
        },
      }
    );
    if (characterData.isGrounded) return;
    castRayFromPoints<THREE.Mesh>(
      getRootScene()?.children || [],
      charMesh.position.clone().sub({ x: -charHalfRadius, y: 0, z: 0 }),
      groundRaycastVecDir,
      {
        // helperId: 'off2GroundDetector',
        startLength: characterData._height / 3,
        endLength: characterData._groundedRayMaxDistance,
        perIntersectFn: (intersect) => {
          if (intersect.object.userData.isPhysicsObject) {
            characterData.isGrounded = true;
            return true;
          }
        },
      }
    );
    if (characterData.isGrounded) return;
    castRayFromPoints<THREE.Mesh>(
      getRootScene()?.children || [],
      charMesh.position.clone().sub({ x: 0, y: 0, z: charHalfRadius }),
      groundRaycastVecDir,
      {
        // helperId: 'off3GroundDetector',
        startLength: characterData._height / 3,
        endLength: characterData._groundedRayMaxDistance,
        perIntersectFn: (intersect) => {
          if (intersect.object.userData.isPhysicsObject) {
            characterData.isGrounded = true;
            return true;
          }
        },
      }
    );
    if (characterData.isGrounded) return;
    castRayFromPoints<THREE.Mesh>(
      getRootScene()?.children || [],
      charMesh.position.clone().sub({ x: 0, y: 0, z: -charHalfRadius }),
      groundRaycastVecDir,
      {
        // helperId: 'off4GroundDetector',
        startLength: characterData._height / 3,
        endLength: characterData._groundedRayMaxDistance,
        perIntersectFn: (intersect) => {
          if (intersect.object.userData.isPhysicsObject) {
            characterData.isGrounded = true;
            return true;
          }
        },
      }
    );
  };

  createSceneAppLooper(() => {
    const physObj = getPhysicsObject(charObj?.physObjectId || '');
    const mesh = physObj?.mesh;
    if (!physObj || !mesh) return;

    // Set isMoving (physics isMoving, aka. is awake)
    characterData.isMoving = physObj.rigidBody?.isMoving() || false;

    // No need to calculate anything if the character is not moving
    if (!characterData.isMoving) return;

    detectGround();

    // Set isFalling
    if (characterData.isGrounded) {
      characterData.__isFallingStartTime = 0;
      characterData.isFalling = false;
    } else if (!characterData.__isFallingStartTime) {
      characterData.__isFallingStartTime = performance.now();
    } else if (
      characterData.__isFallingStartTime + characterData._isFallingThreshold <
      performance.now()
    ) {
      characterData.isFalling = true;
    }

    // Set velocity
    const velo = usableVec.set(
      Math.round(Math.abs(physObj.rigidBody?.linvel().x || 0) * 1000) / 1000,
      Math.round(Math.abs(physObj.rigidBody?.linvel().y || 0) * 1000) / 1000,
      Math.round(Math.abs(physObj.rigidBody?.linvel().z || 0) * 1000) / 1000
    );
    characterData.velocity = {
      x: velo.x,
      y: velo.y,
      z: velo.z,
      world: Math.round(new THREE.Vector3(velo.x, velo.y, velo.z).length() * 1000) / 1000,
    };

    // Set position
    characterData.position.x = physObj.mesh?.position.x || 0;
    characterData.position.y = physObj.mesh?.position.y || 0;
    characterData.position.z = physObj.mesh?.position.z || 0;
  });

  charMesh.castShadow = true;
  charMesh.receiveShadow = true;

  return { fighterCharacterObject: charObj, charMesh, charData };
};
