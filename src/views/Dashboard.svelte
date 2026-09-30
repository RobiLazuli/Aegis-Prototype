<script lang="ts">
  import { onMount } from 'svelte';
  import CameraPanel from '../components/CameraPanel.svelte';
  import LogsPanel from '../components/LogsPanel.svelte';
  import SensorCard from '../components/SensorCard.svelte';
  import ShieldCanvas from '../components/ShieldCanvas.svelte';
  import { fetchLiveLogs, fetchLiveStatus, postCameraEvent, ApiError } from '../lib/api';
  import { beepAlarm } from '../lib/audio';
  import { sim } from '../lib/sim';
  import type { DataSource, LogEntry, Reading, SessionUser } from '../lib/types';

  interface Props {
    user: SessionUser;
    onExit: () => void;
  }
  let { user, onExit }: Props = $props();

  let source = $state<DataSource>('sim');
  let liveReading = $state<Reading | null>(null);
  let liveLogs = $state<LogEntry[]>([]);
  let liveOnline = $state(false);
  let snapshot = $state<string | null>(null);
  let sending = $state(false);

  const reading = $derived<Reading>(source === 'live' && liveReading ? liveReading : $sim.reading);
  const logs = $derived<LogEntry[]>(source === 'live' ? liveLogs : $sim.logs);

  function sysLog(message: string) {
    sim.noteSystem(message);
  }

  async function pollLive(signal: AbortSignal) {
    try {
      const [status, logPage] = await Promise.all([fetchLiveStatus(signal), fetchLiveLogs(0, signal)]);
      if (signal.aborted) return;
      liveOnline = true;
      liveReading = status.reading
        ? {
            tempC: status.reading.tempC,
            gasPpm: status.reading.gasPpm,
            door: status.reading.door,
            status: status.reading.status,
            at: status.reading.at,
          }
        : null;
      liveLogs = logPage.items
        .filter((l) => typeof l.id === 'string' && typeof l.message === 'string')
        .map((l) => ({
          id: l.id,
          level: (['info', 'warn', 'danger', 'system'].includes(l.level) ? l.level : 'info') as LogEntry['level'],
          message: l.message,
          at: l.at,
        }));
    } catch (error) {
      if (signal.aborted) return;
      liveOnline = false;
      if (source === 'live' && error instanceof ApiError && (error.code === 'network_error' || error.code === 'invalid_response')) {
        source = 'sim';
        sysLog('Cloud link unreachable — switched back to the SIMULATION feed.');
      }
    }
  }

  onMount(() => {
    const controller = new AbortController();
    void pollLive(controller.signal).then(() => {
      if (liveOnline) {
        source = 'live';
        sysLog('Cloud link established — showing LIVE room data.');
      }
    });
    const interval = setInterval(() => void pollLive(controller.signal), 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  });

  let prevStatus = $state<'normal' | 'abnormal' | 'danger'>('normal');
  $effect(() => {
    if (reading.status === 'danger' && prevStatus !== 'danger') beepAlarm();
    prevStatus = reading.status;
  });

  function capture(dataUrl: string) {
    snapshot = dataUrl;
    if (source === 'sim') sim.noteCapture();
  }

  async function send() {
    if (!snapshot || sending) {
      if (!snapshot) sysLog('Nothing to send — capture a frame first.');
      return;
    }
    sending = true;
    if (source === 'live') {
      try {
        const result = await postCameraEvent(Math.round((snapshot.length * 3) / 4), 'manual snapshot from dashboard');
        sysLog(
          result.telegram === 'sent'
            ? 'Snapshot event logged — Telegram alert delivered to the watch group.'
            : 'Snapshot event logged. Telegram is not configured yet, so no message was sent.',
        );
        await pollLive(new AbortController().signal);
      } catch {
        sysLog('Snapshot event failed to reach the cloud log.');
      }
    } else {
      sim.noteSend();
    }
    sending = false;
  }

  function toggleSource(next: DataSource) {
    if (next === source) return;
    source = next;
    sysLog(next === 'sim' ? 'Switched to the SIMULATION feed.' : 'Switched to the LIVE cloud feed.');
  }

  function tempState(t: number) {
    return t >= 38 ? 'danger' : t >= 34 ? 'abnormal' : 'normal';
  }
  function gasState(g: number) {
    return g >= 800 ? 'danger' : g >= 500 ? 'abnormal' : 'normal';
  }

  const tempFill = $derived(Math.min(1, Math.max(0, (reading.tempC - 15) / 30)));
  const gasFill = $derived(Math.min(1, reading.gasPpm / 1000));
</script>

<div class="dash" class:alert={reading.status === 'danger'}>
  <header class="bar">
    <div class="brand">
      <ShieldCanvas size={30} animated={false} />
      <span class="name">A·E·G·I·S</span>
      <span class="divider" aria-hidden="true"></span>
      <span class="room-tag mono">ROOM 01</span>
    </div>

    <div class="chip" title={source === 'live' ? 'Cloud database link' : 'Local simulated feed'}>
      <span class="dot" class:dot-on={source === 'live' ? liveOnline : true} class:dot-off={source === 'live' && !liveOnline}></span>
      {source === 'live' ? (liveOnline ? 'IOT CLOUD' : 'CLOUD LOST') : 'SIM LINK'}
    </div>

    <div class="status-group" role="group" aria-label="Room status: {reading.status}">
      <span class="seg" class:on-ok={reading.status === 'normal'}>
        <span class="dot" class:dot-on={reading.status === 'normal'} class:dot-off={reading.status !== 'normal'}></span>NORMAL
      </span>
      <span class="seg" class:on-warn={reading.status === 'abnormal'}>
        <span class="dot" class:dot-warn={reading.status === 'abnormal'} class:dot-off={reading.status !== 'abnormal'}></span>ABNORMAL
      </span>
      <span class="seg" class:on-danger={reading.status === 'danger'}>
        <span class="dot" class:dot-danger={reading.status === 'danger'} class:dot-off={reading.status !== 'danger'}></span>DANGER
      </span>
    </div>

    <div class="bar-right">
      <div class="src-toggle" role="group" aria-label="Data source">
        <button class:active={source === 'sim'} onclick={() => toggleSource('sim')}>SIM</button>
        <button class:active={source === 'live'} onclick={() => toggleSource('live')}>LIVE</button>
      </div>
      <span class="chip user-chip" title="Signed in via {user.method === 'rfid' ? 'RFID card' : 'guest access'}">
        <span class="dot" class:dot-on={true}></span>@{user.name}
      </span>
      <button class="btn btn-ghost btn-sm" onclick={onExit} aria-label="Log out and return to landing">Exit</button>
    </div>
  </header>

  <main class="grid">
    <section class="left">
      <CameraPanel door={reading.door} status={reading.status} onCapture={capture} onSend={send} />

      <div class="sensors">
        <SensorCard label="Temperature" value={reading.tempC.toFixed(1)} unit="°C" state={tempState(reading.tempC)} fill={tempFill} hint={reading.tempC >= 34 ? 'Above comfort range' : 'Within range'} />
        <SensorCard label="Gas / Smoke" value={String(reading.gasPpm)} unit="ppm" state={gasState(reading.gasPpm)} fill={gasFill} hint={reading.gasPpm >= 500 ? 'MQ sensor alarm zone' : 'Air clear'} />
        <SensorCard label="Door" value={reading.door === 'open' ? 'OPEN' : 'SHUT'} state={reading.door === 'open' ? 'abnormal' : 'normal'} fill={reading.door === 'open' ? 1 : 0.08} hint={reading.door === 'open' ? 'Entry detected' : 'Secured'} />
        <div class="snap panel-strong" class:empty={!snapshot}>
          {#if snapshot}
            <img src={snapshot} alt="Last captured camera frame" />
            <span class="snap-label mono">SNAPSHOT</span>
          {:else}
            <span class="snap-placeholder mono" aria-hidden="true">NO FRAME</span>
            <span class="snap-label mono">CAPTURE SLOT</span>
          {/if}
        </div>
      </div>
    </section>

    <aside class="right">
      <LogsPanel {logs} title="Event Log" />
    </aside>
  </main>
</div>

<style>
  .dash {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 14px;
    padding: 14px 16px;
    background:
      radial-gradient(1100px 500px at 12% -10%, rgba(39, 67, 214, 0.16), transparent 60%),
      radial-gradient(900px 500px at 95% 110%, rgba(27, 138, 143, 0.12), transparent 55%),
      var(--bg-0);
  }
  .dash.alert {
    background:
      radial-gradient(1100px 500px at 12% -10%, rgba(61, 29, 142, 0.3), transparent 60%),
      radial-gradient(900px 500px at 95% 110%, rgba(61, 29, 142, 0.2), transparent 55%),
      var(--bg-0);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: rgba(11, 14, 34, 0.6);
    backdrop-filter: blur(8px);
    flex-wrap: wrap;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .name {
    font-family: var(--font-mono);
    font-weight: 500;
    letter-spacing: 0.28em;
    font-size: 0.9rem;
    white-space: nowrap;
  }
  .divider {
    width: 1px;
    height: 18px;
    background: var(--line-strong);
  }
  .room-tag {
    font-size: 0.66rem;
    letter-spacing: 0.2em;
    color: var(--text-faint);
  }
  .status-group {
    display: flex;
    border: 1px solid var(--line);
    border-radius: 999px;
    overflow: hidden;
  }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    border-left: 1px solid var(--line);
  }
  .seg:first-child { border-left: none; }
  .seg.on-ok { color: var(--ok); background: rgba(47, 230, 200, 0.08); }
  .seg.on-warn { color: var(--warn); background: rgba(127, 155, 255, 0.1); }
  .seg.on-danger { color: var(--danger); background: rgba(167, 139, 250, 0.12); }
  .bar-right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .src-toggle {
    display: flex;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    overflow: hidden;
  }
  .src-toggle button {
    border: none;
    background: transparent;
    padding: 6px 13px;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    color: var(--text-faint);
    transition: background 140ms ease, color 140ms ease;
  }
  .src-toggle button.active {
    background: rgba(45, 238, 252, 0.16);
    color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr);
    gap: 14px;
    min-height: 0;
  }
  .left {
    display: grid;
    gap: 14px;
    align-content: start;
    min-width: 0;
  }
  .sensors {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .right {
    min-height: 0;
    display: grid;
  }
  .snap {
    position: relative;
    display: grid;
    place-items: center;
    overflow: hidden;
    min-height: 116px;
    padding: 10px;
    gap: 4px;
  }
  .snap img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .snap.empty { border-style: dashed; }
  .snap-placeholder {
    font-size: 0.72rem;
    letter-spacing: 0.2em;
    color: var(--text-faint);
  }
  .snap-label {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    color: var(--accent);
    background: rgba(11, 14, 34, 0.8);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .snap.empty .snap-label { position: static; }
  @media (max-width: 1020px) {
    .grid { grid-template-columns: 1fr; }
    .sensors { grid-template-columns: repeat(2, 1fr); }
    .bar-right { margin-left: 0; }
  }
</style>
