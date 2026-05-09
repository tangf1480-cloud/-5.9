/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Player } from '../shared/types';

interface Settings {
  volume: number;
  sensitivity: number;
  bloomEnabled: boolean;
  selectedSkin: string;
}

interface GameStore {
  socket: Socket | null;
  gameState: GameState | null;
  playerId: string | null;
  isPaused: boolean;
  togglePause: () => void;
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
  inputs: { left: boolean; right: boolean; boost: boolean };
  setInputs: (inputs: Partial<{ left: boolean; right: boolean; boost: boolean }>) => void;
  joystickAngle: number | null;
  setJoystickAngle: (angle: number | null) => void;
  connect: () => void;
  joinGame: () => void;
  sendPlayerState: (data: any) => void;
  sendCollectOrb: (orbId: string) => void;
}

export const globalGameState: { current: GameState | null } = { current: null };
let lastUiUpdate = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  gameState: null,
  playerId: null,
  isPaused: false,
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  settings: {
    volume: 50,
    sensitivity: 100,
    bloomEnabled: true,
    selectedSkin: '🐱',
  },
  updateSettings: (newSettings) => set((state) => {
    const updated = { ...state.settings, ...newSettings };
    // We could apply audio volume here, but let's do it in a store subscriber or directly
    return { settings: updated };
  }),
  isSettingsOpen: false,
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  inputs: { left: false, right: false, boost: false },
  setInputs: (newInputs) => set((state) => ({ inputs: { ...state.inputs, ...newInputs } })),
  joystickAngle: null,
  setJoystickAngle: (angle) => set({ joystickAngle: angle }),
  connect: () => {
    if (get().socket) return;
    
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('init', (id: string) => {
      set({ playerId: id });
    });

    socket.on('state', (state: GameState) => {
      globalGameState.current = state;
      const now = Date.now();
      if (now - lastUiUpdate > 100) { // Throttle React updates to 10Hz
        set({ gameState: state });
        lastUiUpdate = now;
      }
    });

    set({ socket });
  },
  joinGame: () => {
    const { socket, settings } = get();
    if (socket) {
      socket.emit('join', { skin: settings.selectedSkin });
    }
  },
  sendPlayerState: (data) => {
    const { socket } = get();
    if (socket) {
      socket.emit('update_state', data);
    }
  },
  sendCollectOrb: (orbId) => {
    const { socket } = get();
    if (socket) {
      socket.emit('collect_orb', orbId);
    }
  },
}));
