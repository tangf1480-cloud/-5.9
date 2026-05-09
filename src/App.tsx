/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { GameScene } from './components/GameScene';
import { useGameStore } from './store/gameStore';
import { UI } from './components/UI';

export default function App() {
  const { connect, settings } = useGameStore();

  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="w-screen h-screen bg-[#e8f5e9] overflow-hidden relative">
      <Canvas
        shadows
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: false }}
      >
        <color attach="background" args={['#e8f5e9']} />
        <GameScene />
        {settings.bloomEnabled && (
          <EffectComposer>
            <Bloom
              luminanceThreshold={1.5}
              mipmapBlur
              intensity={1.5}
            />
          </EffectComposer>
        )}
      </Canvas>
      <UI />
    </div>
  );
}
