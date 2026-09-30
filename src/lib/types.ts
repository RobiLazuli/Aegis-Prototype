export type RoomStatus = 'normal' | 'abnormal' | 'danger';
export type DoorState = 'open' | 'closed';
export type LogLevel = 'info' | 'warn' | 'danger' | 'system';

export interface Reading {
  tempC: number;
  gasPpm: number;
  door: DoorState;
  status: RoomStatus;
  at: string;
}

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  at: string;
}

export interface SessionUser {
  name: string;
  method: 'rfid' | 'guest';
}

export type DataSource = 'live' | 'sim';

export function statusFromReading(tempC: number, gasPpm: number, door: DoorState): RoomStatus {
  if (tempC >= 38 || gasPpm >= 800) return 'danger';
  if (tempC >= 34 || gasPpm >= 500 || door === 'open') return 'abnormal';
  return 'normal';
}
