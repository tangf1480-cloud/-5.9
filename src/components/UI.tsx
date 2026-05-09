/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, ChevronLeft, ChevronRight, Zap, Gamepad2, Settings as SettingsIcon, X } from 'lucide-react';
import { audio } from '../utils/audio';

function SettingsModal() {
  const { settings, updateSettings, isSettingsOpen, setSettingsOpen } = useGameStore();

  if (!isSettingsOpen) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-zinc-900/95 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full flex flex-col gap-6"
      >
        <div className="flex justify-between items-center text-white">
          <h2 className="text-2xl font-black tracking-wider">SETTINGS</h2>
          <button onClick={() => setSettingsOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-white">
          {/* Volume */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white/80">Master Volume: {settings.volume}%</label>
            <input 
              type="range" 
              min="0" max="100" 
              value={settings.volume} 
              onChange={(e) => {
                const vol = parseInt(e.target.value);
                updateSettings({ volume: vol });
                if (audio.isInitialized) audio.setVolume(vol / 100);
              }}
              className="w-full accent-white"
            />
          </div>

          {/* Sensitivity */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-white/80">Turn Sensitivity: {settings.sensitivity}%</label>
            <input 
              type="range" 
              min="10" max="300" 
              value={settings.sensitivity} 
              onChange={(e) => updateSettings({ sensitivity: parseInt(e.target.value) })}
              className="w-full accent-white"
            />
          </div>

          {/* Bloom Toggle */}
          <div className="flex items-center justify-between mt-2">
            <label className="text-sm font-bold text-white/80 cursor-pointer" htmlFor="bloom-toggle">Visual Base Effects (Bloom)</label>
            <input 
              id="bloom-toggle"
              type="checkbox" 
              checked={settings.bloomEnabled} 
              onChange={(e) => updateSettings({ bloomEnabled: e.target.checked })}
              className="w-5 h-5 accent-white rounded"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Joystick() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);
  const { setJoystickAngle } = useGameStore();

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
    updatePosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updatePosition(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    setJoystickAngle(null);
    // @ts-ignore
    e.target.releasePointerCapture(e.pointerId);
  };

  const updatePosition = (e: React.PointerEvent) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = rect.width / 2 - 20;
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    setPosition({ x: dx, y: dy });
    
    const angle = Math.atan2(-dy, dx); 
    setJoystickAngle(angle);
  };

  return (
    <div 
      ref={baseRef}
      className="w-32 h-32 rounded-full border-2 border-white/20 bg-black/20 touch-none relative flex items-center justify-center pointer-events-auto backdrop-blur-md"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="absolute inset-0 flex items-center justify-center rounded-full opacity-30 pointer-events-none">
        <Gamepad2 size={32} className="text-white" />
      </div>
      <div 
        className="w-12 h-12 rounded-full bg-white/80 shadow-lg absolute pointer-events-none"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      />
    </div>
  );
}

export const defaultSkins = ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];

export function UI() {
  const { gameState, playerId, joinGame, setInputs, isPaused, togglePause, settings, updateSettings } = useGameStore();

  const player = playerId && gameState ? gameState.players[playerId] : null;
  const isAlive = player?.state === 'alive';
  const isDead = player?.state === 'dead';

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto relative">
        <div className="flex flex-col gap-2 z-10">
          <h1 className="text-3xl font-black text-white tracking-tighter" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>
            NEON.SNAKE
          </h1>
          {isAlive && (
            <div className="text-xl font-mono text-white/80 font-bold">
              Length: {Math.floor(player.score)}
            </div>
          )}
        </div>
        
        {/* Controls Hint */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 flex gap-2 opacity-80 pointer-events-none hidden sm:flex">
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">A</span>
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">D</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Turn</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
            <span className="font-bold bg-white/20 px-1.5 py-0.5 rounded text-white">SPACE</span>
            <span className="text-white/70 uppercase tracking-wider text-[10px]">Boost</span>
          </div>
        </div>

        <div className="flex gap-2 z-10 pointer-events-auto">
          <button
            onClick={() => useGameStore.getState().setSettingsOpen(true)}
            className="flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors border border-white/10"
          >
            <SettingsIcon size={20} />
          </button>
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white text-sm font-bold transition-colors border border-white/10 hidden sm:flex"
          >
            <ExternalLink size={16} />
            <span>New Tab</span>
          </button>
        </div>
      </div>

      {/* Top right HUD area */}
      <div className="absolute top-4 right-4 flex flex-col gap-4 items-end pointer-events-none">
        
        {isAlive && (
          <button
            onClick={() => togglePause()}
            className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white active:bg-white/30 transition-colors pointer-events-auto shadow-lg"
          >
            {isPaused ? '▶' : '⏸'}
          </button>
        )}

        {/* Leaderboard */}
        {gameState && gameState.leaderboard.length > 0 && (
          <div className="w-64 bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 pointer-events-auto">
            <div className="flex items-center gap-2 mb-4 text-white/80 font-semibold">
              <Trophy size={18} className="text-yellow-400" />
              <h2>LEADERBOARD</h2>
            </div>
            <div className="flex flex-col gap-2">
              {gameState.leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-white/40 w-4">{i + 1}.</span>
                    <span className="text-lg">{entry.skin || '🐱'}</span>
                    <span style={{ color: entry.color }} className="font-medium truncate max-w-[120px]">
                      {entry.name}
                    </span>
                  </div>
                  <span className="font-mono text-white/80">{entry.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* On-Screen Mobile Controls */}
      {isAlive && (
        <div className="absolute bottom-8 left-0 w-full px-8 flex justify-between pointer-events-none select-none touch-none">
          {/* Turn Buttons / Joystick */}
          <div className="flex gap-4 pointer-events-auto">
            <Joystick />
          </div>
          
          {/* Boost Button */}
          <div className="pointer-events-auto">
            <button
              className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white active:bg-white/30 transition-colors touch-none focus:outline-none"
              onPointerDown={(e) => { e.preventDefault(); setInputs({ boost: true }); }}
              onPointerUp={(e) => { e.preventDefault(); setInputs({ boost: false }); }}
              onPointerLeave={(e) => { e.preventDefault(); setInputs({ boost: false }); }}
              onPointerCancel={(e) => { e.preventDefault(); setInputs({ boost: false }); }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <Zap size={32} />
            </button>
          </div>
        </div>
      )}

      {/* Menus */}
      <AnimatePresence>
        {(!player || isDead) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-zinc-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-md w-full flex flex-col items-center gap-6">
              {isDead && (
                <div className="text-center">
                  <h2 className="text-4xl font-black text-red-500 mb-2">YOU DIED</h2>
                  <p className="text-white/60">Final Length: {Math.floor(player.score)}</p>
                </div>
              )}
              
              {!isDead && (
                <div className="text-center w-full">
                  <h2 className="text-3xl font-black text-white mb-2">JOIN ARENA</h2>
                  <p className="text-white/60 text-sm mb-4">Steer with A/D or Left/Right. Space to boost.</p>
                </div>
              )}
              
              <div className="w-full text-left mb-2">
                <label className="text-white/80 text-sm font-bold">Cartoon Skin:</label>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mb-4 max-h-32 overflow-y-auto no-scrollbar pb-2 w-full">
                {defaultSkins.map(skin => (
                  <button
                    key={skin}
                    onClick={() => updateSettings({ selectedSkin: skin })}
                    className={`text-3xl p-2 rounded-xl transition-all ${settings.selectedSkin === skin ? 'bg-white/20 scale-110 border border-white/50' : 'hover:bg-white/10 hover:scale-105 border border-transparent'}`}
                  >
                    {skin}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => {
                  audio.init();
                  audio.resume();
                  audio.startBGM();
                  joinGame();
                }}
                className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
              >
                {isDead ? 'RESPAWN' : 'PLAY'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {isAlive && isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm"
          >
            <div className="bg-zinc-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-sm w-full flex flex-col items-center gap-6">
              <h2 className="text-5xl font-black text-white tracking-widest text-center">PAUSED</h2>
              <p className="text-white/60 tracking-widest text-sm uppercase text-center">Press P to Resume</p>
              <button
                onClick={() => useGameStore.getState().togglePause()}
                className="w-full py-4 mt-2 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors active:scale-95 pointer-events-auto"
              >
                RESUME
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <SettingsModal />
      </AnimatePresence>
    </div>
  );
}
