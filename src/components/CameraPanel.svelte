<script lang="ts">
  import { onMount } from 'svelte';
  import { beepShutter } from '../lib/audio';
  import type { DoorState, RoomStatus } from '../lib/types';

  interface Props {
    door: DoorState;
    status: RoomStatus;
    onCapture: (dataUrl: string) => void;
    onSend: () => void;
  }
  let { door, status, onCapture, onSend }: Props = $props();

  let canvas: HTMLCanvasElement;
  let flash = $state(false);

  const W = 640;
  const H = 360;

  function drawFeed(ctx: CanvasRenderingContext2D, t: number, doorState: DoorState, roomStatus: RoomStatus) {
    ctx.clearRect(0, 0, W, H);

    const danger = roomStatus === 'danger';
    const abnormal = roomStatus === 'abnormal';

    // room shell
    const wall = ctx.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, danger ? '#221a44' : '#131a38');
    wall.addColorStop(1, danger ? '#1a1436' : '#0e1329');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);

    // perspective floor grid
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.07)';
    ctx.lineWidth = 1;
    const horizon = H * 0.72;
    for (let i = 0; i <= 12; i++) {
      const x = (W / 12) * i;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(W / 2 + (x - W / 2) * 2.4, H);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const y = horizon + ((H - horizon) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(W, horizon);
    ctx.stroke();

    // window — night sky strip
    const wx = W * 0.66, wy = H * 0.14, ww = W * 0.26, wh = H * 0.36;
    ctx.fillStyle = '#0a0e22';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath();
    ctx.arc(wx + ww * 0.72, wy + wh * 0.28, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#bee9f6';
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(wx + 10 + (i * 41) % ww, wy + 12 + (i * 47) % wh, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 230, 250, 0.8)';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.14)';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(wx, wy + (wh / 4) * i);
      ctx.lineTo(wx + ww, wy + (wh / 4) * i);
      ctx.stroke();
    }

    // door — wireframe panel, slides with the sensor
    const dx = W * 0.08, dy = H * 0.18, dw = W * 0.16, dh = H * 0.54;
    const openShift = doorState === 'open' ? dw * 0.55 : 0;
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(dx - 5, dy - 5, dw + 10, dh + 10);
    ctx.fillStyle = doorState === 'open' ? 'rgba(61, 29, 142, 0.35)' : 'rgba(31, 78, 121, 0.4)';
    ctx.fillRect(dx + openShift, dy, dw, dh);
    ctx.strokeStyle = doorState === 'open' ? 'rgba(167, 139, 250, 0.7)' : 'rgba(124, 244, 238, 0.5)';
    ctx.strokeRect(dx + openShift, dy, dw, dh);
    ctx.beginPath();
    ctx.arc(dx + openShift + dw * 0.82, dy + dh * 0.52, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2deefc';
    ctx.fill();

    // sensor node marker on the wall
    const sx = W * 0.4, sy = H * 0.3;
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(sx - 8, sy - 8, 16, 16);
    const ping = (t % 2000) / 2000;
    ctx.beginPath();
    ctx.arc(sx, sy, 4 + ping * 18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(45, 238, 252, ${0.5 * (1 - ping)})`;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#7cf4ee';
    ctx.fill();

    // plant — minimal line art
    const px = W * 0.52, py = horizon;
    ctx.strokeStyle = 'rgba(47, 230, 200, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + i * 10, py - 26, px + i * 15, py - 40 - Math.abs(i) * -5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(px - 16, py);
    ctx.lineTo(px + 16, py);
    ctx.lineTo(px + 11, py + 24);
    ctx.lineTo(px - 11, py + 24);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(47, 230, 200, 0.8)';
    ctx.stroke();

    // scanline sweep
    const sweepY = (t / 26) % (H * 1.4) - H * 0.2;
    const sweep = ctx.createLinearGradient(0, sweepY - 26, 0, sweepY + 26);
    sweep.addColorStop(0, 'rgba(45, 238, 252, 0)');
    sweep.addColorStop(0.5, 'rgba(45, 238, 252, 0.07)');
    sweep.addColorStop(1, 'rgba(45, 238, 252, 0)');
    ctx.fillStyle = sweep;
    ctx.fillRect(0, sweepY - 26, W, 52);

    // fine CRT lines
    ctx.fillStyle = 'rgba(6, 8, 20, 0.22)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    // danger vignette
    if (danger) {
      const flick = 0.2 + Math.abs(Math.sin(t / 150)) * 0.16;
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, 'rgba(61, 29, 142, 0)');
      vg.addColorStop(1, `rgba(61, 29, 142, ${flick + 0.3})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD frame corners
    ctx.strokeStyle = danger ? 'rgba(167, 139, 250, 0.9)' : 'rgba(45, 238, 252, 0.55)';
    ctx.lineWidth = 1.5;
    const c = 18;
    for (const [hx, hy, cx2, cy2] of [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(hx + c * cx2, hy);
      ctx.lineTo(hx, hy);
      ctx.lineTo(hx, hy + c * cy2);
      ctx.stroke();
    }

    // HUD text
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = danger ? '#c4b0f5' : 'rgba(124, 244, 238, 0.85)';
    ctx.fillText('CAM 01 · ROOM', 18, 28);
    const blink = Math.sin(t / 400) > -0.2;
    if (blink) {
      ctx.beginPath();
      ctx.arc(126, 24, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = danger ? '#a78bfa' : '#2fe6c8';
      ctx.fill();
    }
    ctx.fillText('REC', 136, 28);

    ctx.textAlign = 'right';
    const now = new Date();
    ctx.fillText(now.toLocaleString('en-GB', { hour12: false }), W - 18, H - 16);

    if (danger || abnormal) {
      ctx.textAlign = 'center';
      ctx.font = '600 13px "JetBrains Mono", monospace';
      ctx.fillStyle = danger ? '#d9c8ff' : '#9db4ff';
      ctx.fillText(danger ? '■ HAZARD CONDITION — ALERT ACTIVE' : '■ CONDITION ABNORMAL', W / 2, 30);
    }
  }

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    let raf = 0;
    const loop = (t: number) => {
      drawFeed(ctx, t, door, status);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function capture() {
    beepShutter();
    flash = true;
    setTimeout(() => (flash = false), 200);
    onCapture(canvas.toDataURL('image/png'));
  }
</script>

<div class="camera panel-strong">
  <div class="cam-head">
    <span class="cam-title mono">OPTICAL FEED</span>
    <div class="cam-actions">
      <button class="btn btn-sm" onclick={capture}>Capture</button>
      <button class="btn btn-primary btn-sm" onclick={onSend}>Send Image</button>
    </div>
  </div>
  <div class="feed">
    <span role="img" aria-label="Simulated security camera feed of the monitored room" class="feed-canvas">
      <canvas bind:this={canvas} style="aspect-ratio: {W}/{H};" aria-hidden="true"></canvas>
    </span>
    {#if flash}<div class="flash" aria-hidden="true"></div>{/if}
  </div>
</div>

<style>
  .camera {
    padding: 14px 16px 16px;
    display: grid;
    gap: 12px;
  }
  .cam-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cam-title {
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    color: var(--text-faint);
  }
  .cam-actions {
    display: flex;
    gap: 8px;
  }
  .feed {
    position: relative;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    overflow: hidden;
    background: #0a0d1f;
  }
  .feed-canvas { display: block; }
  canvas {
    display: block;
    width: 100%;
  }
  .flash {
    position: absolute;
    inset: 0;
    background: #eafffe;
    animation: flashfade 200ms ease-out forwards;
  }
  @keyframes flashfade {
    from { opacity: 0.85; }
    to { opacity: 0; }
  }
</style>
