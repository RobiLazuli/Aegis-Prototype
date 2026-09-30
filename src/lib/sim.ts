// Guest-trial sensor simulation. Stands in for the ESP32 firmware until it ships;
// clearly labeled as SIMULATION in the UI.
import { writable, type Readable } from 'svelte/store';
import { statusFromReading, type LogEntry, type Reading, type RoomStatus } from './types';

interface SimState {
  reading: Reading;
  logs: LogEntry[];
  running: boolean;
}

const TICK_MS = 2500;
const MAX_LOGS = 60;

let timer: ReturnType<typeof setInterval> | null = null;
let tempC = 27.4;
let gasPpm = 210;
let door: 'open' | 'closed' = 'closed';
let episode: { kind: 'gas' | 'heat' | 'door'; ticksLeft: number } | null = null;
let ticksSinceEpisode = 0;
let prevStatus: RoomStatus = 'normal';
let prevDoor: 'open' | 'closed' = 'closed';

const initial: SimState = {
  reading: { tempC, gasPpm, door, status: 'normal', at: new Date().toISOString() },
  logs: [],
  running: false,
};

const store = writable<SimState>(initial);

function pushLog(level: LogEntry['level'], message: string) {
  store.update((s) => ({
    ...s,
    logs: [
      { id: crypto.randomUUID(), level, message, at: new Date().toISOString() },
      ...s.logs,
    ].slice(0, MAX_LOGS),
  }));
}

function drift(value: number, step: number, min: number, max: number): number {
  const next = value + (Math.random() * 2 - 1) * step;
  return Math.min(max, Math.max(min, next));
}

function tick() {
  ticksSinceEpisode += 1;

  if (!episode && ticksSinceEpisode > 14 && Math.random() < 0.06) {
    const roll = Math.random();
    const kind = roll < 0.45 ? 'gas' : roll < 0.8 ? 'heat' : 'door';
    episode = { kind, ticksLeft: 4 + Math.floor(Math.random() * 4) };
    ticksSinceEpisode = 0;
  }

  if (episode) {
    episode.ticksLeft -= 1;
    if (episode.kind === 'gas') gasPpm = drift(gasPpm, 90, 480, 940);
    if (episode.kind === 'heat') tempC = drift(tempC, 1.6, 34.5, 39.5);
    if (episode.kind === 'door') door = 'open';
    if (episode.ticksLeft <= 0) {
      episode = null;
      if (door === 'open') door = 'closed';
    }
  } else {
    tempC = drift(tempC, 0.35, 23, 31.5);
    gasPpm = drift(gasPpm, 18, 140, 380);
    if (Math.random() < 0.015) door = door === 'closed' ? 'open' : 'closed';
    else if (door === 'open' && Math.random() < 0.4) door = 'closed';
  }

  const status = statusFromReading(tempC, gasPpm, door);
  const reading: Reading = {
    tempC: Math.round(tempC * 10) / 10,
    gasPpm: Math.round(gasPpm),
    door,
    status,
    at: new Date().toISOString(),
  };
  store.update((s) => ({ ...s, reading }));

  if (status !== prevStatus) {
    if (status === 'danger') {
      pushLog('danger', `DANGER — temp ${reading.tempC}°C, gas ${reading.gasPpm} ppm. Telegram alert would be sent to the watch group.`);
    } else if (status === 'abnormal') {
      pushLog('warn', `Abnormal condition — temp ${reading.tempC}°C, gas ${reading.gasPpm} ppm, door ${door}. Telegram heads-up would be sent.`);
    } else {
      pushLog('info', 'Room condition back to normal.');
    }
    prevStatus = status;
  }
  if (door !== prevDoor) {
    pushLog('info', door === 'open' ? 'Door opened.' : 'Door closed.');
    prevDoor = door;
  }
}

export const sim: {
  subscribe: Readable<SimState>['subscribe'];
  start: () => void;
  noteSystem: (message: string) => void;
  noteCapture: () => void;
  noteSend: () => void;
} = {
  subscribe: store.subscribe,
  start() {
    if (timer) return;
    store.update((s) => ({ ...s, running: true }));
    pushLog('system', 'SIMULATION feed started — waiting for real firmware.');
    timer = setInterval(tick, TICK_MS);
  },
  noteSystem(message: string) {
    pushLog('system', message);
  },
  noteCapture() {
    pushLog('info', 'Camera frame captured.');
  },
  noteSend() {
    pushLog('info', 'Snapshot handed to the room monitor — Telegram delivery is simulated in guest mode.');
  },
};
