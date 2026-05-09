/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect, useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, globalGameState } from '../store/gameStore';
import { WORLD_SIZE, TURN_SPEED, BOOST_SPEED, BASE_SPEED } from '../shared/types';
import * as THREE from 'three';
import { Sphere, Grid } from '@react-three/drei';
import { audio } from '../utils/audio';

const localCollectedOrbs = new Set<string>();

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: THREE.Color;
  age: number;
  maxAge: number;
  scale: number;
}

function CollectionParticles({ particlesRef }: { particlesRef: React.MutableRefObject<Particle[]> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (useGameStore.getState().isPaused) return;
    if (!meshRef.current) return;

    let count = 0;
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.age += delta;
      if (p.age >= p.maxAge) {
        particlesRef.current.splice(i, 1);
        continue;
      }
      
      const progress = p.age / p.maxAge;
      p.vx *= Math.pow(0.01, delta); // frame-rate independent drag
      p.vy *= Math.pow(0.01, delta);
      p.x += p.vx * delta;
      p.y += p.vy * delta;

      const currentScale = p.scale * (1 - progress);

      dummy.position.set(p.x, p.y, -0.1);
      dummy.scale.set(currentScale, currentScale, currentScale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(count, dummy.matrix);
      meshRef.current.setColorAt(count, p.color);
      count++;
    }

    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 500]} depthWrite={false}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

const textureMap = new Map<string, THREE.CanvasTexture>();

function getEmojiTexture(emoji: string, color: string) {
  const key = `${emoji}-${color}`;
  if (textureMap.has(key)) return textureMap.get(key)!;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);

  ctx.font = '160px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Draw multiple times to tile slightly if needed, or just center
  ctx.fillText(emoji || '🐭', 128, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Repeat to make it tile nicely on sphere
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  textureMap.set(key, tex);
  return tex;
}

function Snake({ playerId, color, skin, isLocal }: { playerId: string, color: string, skin: string, isLocal: boolean }) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const currentPositions = useRef<{x: number, y: number}[]>([]);

  const skinTexture = useMemo(() => getEmojiTexture(skin, color), [skin, color]);

  useFrame((state, delta) => {
    if (useGameStore.getState().isPaused) return;
    if (!bodyRef.current || !headRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;
    
    const player = gs.players[playerId];
    if (!player || player.segments.length === 0) {
      bodyRef.current.count = 0;
      headRef.current.visible = false;
      return;
    }
    
    // Glow and Light effect for boosting
    if (isLocal) {
      const targetGlow = player.isBoosting ? 6.0 : 0.0;
      const targetLightIntensity = player.isBoosting ? 25.0 : 0.0;
      
      if (materialRef.current) {
        materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(materialRef.current.emissiveIntensity, targetGlow, delta * 15);
      }
      if (bodyMaterialRef.current) {
        bodyMaterialRef.current.emissiveIntensity = THREE.MathUtils.lerp(bodyMaterialRef.current.emissiveIntensity, targetGlow * 0.7, delta * 15);
      }
      if (pointLightRef.current) {
        pointLightRef.current.intensity = THREE.MathUtils.lerp(pointLightRef.current.intensity, targetLightIntensity, delta * 15);
      }
    }

    headRef.current.visible = true;
    const count = player.segments.length;
    bodyRef.current.count = Math.max(0, count - 1);
    
    while (currentPositions.current.length < count) {
      const idx = currentPositions.current.length;
      currentPositions.current.push({ 
        x: player.segments[idx]?.x || 0, 
        y: player.segments[idx]?.y || 0 
      });
    }

    for (let i = 0; i < count; i++) {
      let targetX = player.segments[i].x;
      let targetY = player.segments[i].y;
      
      const curr = currentPositions.current[i];
      if (isLocal) {
        curr.x = targetX;
        curr.y = targetY;
      } else {
        const dist = Math.abs(targetX - curr.x) + Math.abs(targetY - curr.y);
        if (dist > 10) {
          curr.x = targetX;
          curr.y = targetY;
        } else {
          const lerpFactor = 15;
          curr.x += (targetX - curr.x) * lerpFactor * delta;
          curr.y += (targetY - curr.y) * lerpFactor * delta;
        }
      }
      
      if (i === 0) {
        headRef.current.position.set(curr.x, curr.y, 0.5);
      } else {
        dummy.position.set(curr.x, curr.y, 0.5);
        dummy.updateMatrix();
        bodyRef.current.setMatrixAt(i - 1, dummy.matrix);
      }
    }
    bodyRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <Sphere ref={headRef} castShadow receiveShadow args={[0.8, 16, 16]}>
        {isLocal && <pointLight ref={pointLightRef} color={color} distance={30} decay={2} intensity={0} />}
        <meshStandardMaterial
          ref={materialRef}
          color={0xffffff}
          map={skinTexture}
          emissive={color}
          emissiveIntensity={0}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 3.0);
              `
            );
          }}
        />
      </Sphere>
      <instancedMesh ref={bodyRef} args={[null as any, null as any, 2000]} castShadow receiveShadow frustumCulled={false}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={0xffffff}
          map={skinTexture}
          emissive={color}
          emissiveIntensity={0}
          roughness={0.2}
          metalness={0.8}
          toneMapped={false}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `
              #include <emissivemap_fragment>
              float fresnel = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.0);
              totalEmissiveRadiance += diffuseColor.rgb * (0.4 + fresnel * 1.5);
              `
            );
          }}
        />
      </instancedMesh>
    </group>
  );
}

function Orbs() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const gs = globalGameState.current;
    if (!gs) return;

    let i = 0;
    for (const orbId in gs.orbs) {
      if (localCollectedOrbs.has(orbId)) continue;
      const orb = gs.orbs[orbId];
      dummy.position.set(orb.x, orb.y, 0.5);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorObj.set(orb.color);
      meshRef.current.setColorAt(i, colorObj);
      i++;
    }
    meshRef.current.count = i;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, 1000]} castShadow receiveShadow frustumCulled={false}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        toneMapped={false}
        onBeforeCompile={(shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            totalEmissiveRadiance += diffuseColor.rgb * 2.5;
            `
          );
        }}
      />
    </instancedMesh>
  );
}

export function GameScene() {
  const { gameState, playerId, sendPlayerState, sendCollectOrb, setInputs } = useGameStore();
  const { camera } = useThree();
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const [lightTarget] = useState(() => new THREE.Object3D());
  const particlesRef = useRef<Particle[]>([]);

  const localPlayerRef = useRef<{
    active: boolean;
    segments: {x: number, y: number}[];
    score: number;
    currentAngle: number;
    isBoosting: boolean;
    lastSendTime: number;
  }>({
    active: false,
    segments: [],
    score: 10,
    currentAngle: 0,
    isBoosting: false,
    lastSendTime: 0,
  });

  useEffect(() => {
    let prevPaused = useGameStore.getState().isPaused;
    return useGameStore.subscribe((state) => {
      if (state.isPaused !== prevPaused) {
        if (state.isPaused) {
          audio.stopBoost();
          audio.context?.suspend();
        } else {
          audio.context?.resume();
        }
        prevPaused = state.isPaused;
      }
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') setInputs({ left: true });
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') setInputs({ right: true });
      if (e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') setInputs({ boost: true });
      if (e.key === 'p' || e.key === 'P') useGameStore.getState().togglePause();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') setInputs({ left: false });
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') setInputs({ right: false });
      if (e.key === ' ' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') setInputs({ boost: false });
    };

    const handleBlur = () => {
      setInputs({ left: false, right: false, boost: false });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [setInputs]);

  useFrame((state, delta) => {
    if (useGameStore.getState().isPaused) return;
    const gs = globalGameState.current;
    if (!gs || !playerId) return;
    
    // Grab the inputs directly inside the frame loop by calling getState()
    const currentInputs = useGameStore.getState().inputs;

    const serverPlayer = gs.players[playerId];
    if (serverPlayer && serverPlayer.state === 'alive') {
      
      // Initialize from server if not active
      if (!localPlayerRef.current.active && serverPlayer.segments.length > 0) {
        localPlayerRef.current.active = true;
        localPlayerRef.current.segments = [...serverPlayer.segments];
        localPlayerRef.current.score = serverPlayer.score;
        localPlayerRef.current.currentAngle = serverPlayer.currentAngle;
      }

      if (!localPlayerRef.current.active) return;

      // Local movement logic
      const settings = useGameStore.getState().settings;
      const currentTurnSpeed = TURN_SPEED * (settings.sensitivity / 100);

      if (currentInputs.left) localPlayerRef.current.currentAngle += currentTurnSpeed * delta;
      if (currentInputs.right) localPlayerRef.current.currentAngle -= currentTurnSpeed * delta;
      
      const joystickAngle = useGameStore.getState().joystickAngle;
      if (joystickAngle !== null) {
        let diff = joystickAngle - localPlayerRef.current.currentAngle;
        // Normalize diff to [-PI, PI]
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > 0.05) {
          const maxTurn = currentTurnSpeed * delta;
          localPlayerRef.current.currentAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);
        }
      }
      
      const wasBoosting = localPlayerRef.current.isBoosting;
      localPlayerRef.current.isBoosting = currentInputs.boost && localPlayerRef.current.score > 10;
      if (localPlayerRef.current.isBoosting && !wasBoosting) {
        audio.startBoost();
      } else if (!localPlayerRef.current.isBoosting && wasBoosting) {
        audio.stopBoost();
      }
      const speed = localPlayerRef.current.isBoosting ? BOOST_SPEED : BASE_SPEED;
      
      const head = { ...localPlayerRef.current.segments[0] };
      head.x += Math.cos(localPlayerRef.current.currentAngle) * speed * delta;
      head.y += Math.sin(localPlayerRef.current.currentAngle) * speed * delta;

      // Boundary check
      const boundary = WORLD_SIZE / 2;
      if (head.x < -boundary) head.x = -boundary;
      if (head.x > boundary) head.x = boundary;
      if (head.y < -boundary) head.y = -boundary;
      if (head.y > boundary) head.y = boundary;

      localPlayerRef.current.segments.unshift(head);

      if (localPlayerRef.current.isBoosting) {
        localPlayerRef.current.score -= 2 * delta;
        if (localPlayerRef.current.score <= 10) {
          localPlayerRef.current.isBoosting = false;
          localPlayerRef.current.score = 10;
        }
      }

      const targetLength = Math.floor(localPlayerRef.current.score);
      while (localPlayerRef.current.segments.length > targetLength) {
        localPlayerRef.current.segments.pop();
      }

      // Check orb collisions
      for (const orbId in gs.orbs) {
        if (localCollectedOrbs.has(orbId)) continue;
        const orb = gs.orbs[orbId];
        const dx = head.x - orb.x;
        const dy = head.y - orb.y;
        if (dx * dx + dy * dy < 4) {
          localPlayerRef.current.score += orb.value;
          localCollectedOrbs.add(orbId);
          delete gs.orbs[orbId]; // predict locally
          sendCollectOrb(orbId);
          audio.playCollect();

          // Particle burst
          const pulseCount = 10;
          const baseColor = new THREE.Color(orb.color).multiplyScalar(2.5);
          for(let i=0; i<pulseCount; i++) {
             const angle = (Math.PI * 2 / pulseCount) * i + Math.random() * 0.5;
             const speed = 10 + Math.random() * 15;
             particlesRef.current.push({
               x: orb.x,
               y: orb.y,
               vx: Math.cos(angle) * speed,
               vy: Math.sin(angle) * speed,
               color: baseColor,
               age: 0,
               maxAge: 0.3 + Math.random() * 0.3,
               scale: 0.8 + Math.random() * 0.5
             });
          }
        }
      }

      // Cleanup localCollectedOrbs occasionally
      if (Math.random() < 0.05) {
        for (const id of localCollectedOrbs) {
          if (!gs.orbs[id]) localCollectedOrbs.delete(id);
        }
      }

      // Check player collisions
      let collided = false;
      for (const otherId in gs.players) {
        if (otherId === playerId) continue;
        const other = gs.players[otherId];
        if (other.state !== 'alive') continue;
        for (const seg of other.segments) {
          const dx = head.x - seg.x;
          const dy = head.y - seg.y;
          if (dx * dx + dy * dy < 2.25) {
            collided = true;
            break;
          }
        }
        if (collided) break;
      }

      if (collided) {
        localPlayerRef.current.active = false;
        audio.stopBoost();
        audio.playDeath();
        audio.stopBGM();
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'dead'
        });
        return;
      }

      // Overwrite global state for local rendering
      gs.players[playerId].segments = localPlayerRef.current.segments;
      gs.players[playerId].score = localPlayerRef.current.score;
      gs.players[playerId].currentAngle = localPlayerRef.current.currentAngle;
      gs.players[playerId].isBoosting = localPlayerRef.current.isBoosting;

      // Send state to server at 20Hz
      const now = Date.now();
      if (now - localPlayerRef.current.lastSendTime > 50) {
        sendPlayerState({
          segments: localPlayerRef.current.segments,
          score: localPlayerRef.current.score,
          currentAngle: localPlayerRef.current.currentAngle,
          isBoosting: localPlayerRef.current.isBoosting,
          state: 'alive'
        });
        localPlayerRef.current.lastSendTime = now;
      }

      const targetZ = Math.min(45, Math.max(20, 20 + localPlayerRef.current.score * 0.2));
      
      // Smooth camera follow predicted head
      camera.position.x += (head.x - camera.position.x) * 10 * delta;
      camera.position.y += (head.y - camera.position.y) * 10 * delta;
      camera.position.z += (targetZ - camera.position.z) * 4 * delta;
      camera.lookAt(camera.position.x, camera.position.y, 0);

      // Make the directional light follow the camera to keep shadows crisp
      if (lightRef.current) {
        lightRef.current.position.set(camera.position.x + 10, camera.position.y - 10, 30);
        lightTarget.position.set(camera.position.x, camera.position.y, 0);
      }
    } else {
      localPlayerRef.current.active = false;
    }
  });

  if (!gameState) return null;

  return (
    <>
      <ambientLight intensity={0.4} />
      
      <directionalLight
        ref={lightRef}
        target={lightTarget}
        castShadow
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        shadow-bias={-0.001}
      />
      <primitive object={lightTarget} />

      {/* Ground plane to receive shadows */}
      <mesh receiveShadow position={[0, 0, -0.2]}>
        <planeGeometry args={[WORLD_SIZE, WORLD_SIZE]} />
        <meshStandardMaterial color="#e8f5e9" />
      </mesh>

      <Grid
        position={[0, 0, -0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        args={[WORLD_SIZE, WORLD_SIZE]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#a5d6a7"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#66bb6a"
        fadeDistance={100}
        fadeStrength={1}
      />

      <Orbs />

      <CollectionParticles particlesRef={particlesRef} />

      {Object.values(gameState.players).map((player) => {
        if (player.state !== 'alive' || player.segments.length === 0) return null;
        return (
          <Snake
            key={player.id}
            playerId={player.id}
            color={player.color}
            skin={player.skin || '🐱'}
            isLocal={player.id === playerId}
          />
        );
      })}
    </>
  );
}
