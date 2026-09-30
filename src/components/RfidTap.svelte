<script lang="ts">
  import { onMount } from 'svelte';
  import { beepCard, beepOk } from '../lib/audio';

  interface Props {
    onTap: (cardName: string) => void;
  }
  let { onTap }: Props = $props();

  let canvas: HTMLCanvasElement;
  let state = $state<'idle' | 'tapping' | 'accepted'>('idle');

  const CARD_NAME = 'admin';

  function drawScene(ctx: CanvasRenderingContext2D, t: number, phase: string) {
    const dpr = window.devicePixelRatio || 1;
    const w = ctx.canvas.width / dpr;
    const h = ctx.canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2 + 22;

    // reader pad — recessed ring
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.14)';
    ctx.stroke();

    // pad status arc
    const arcColor = phase === 'accepted' ? '#2fe6c8' : phase === 'tapping' ? '#2deefc' : 'rgba(139, 163, 192, 0.5)';
    const sweep = phase === 'idle' ? Math.PI * 0.5 : (t / 600) % (Math.PI * 2);
    ctx.beginPath();
    ctx.arc(cx, cy, 62, -Math.PI / 2, -Math.PI / 2 + (phase === 'accepted' ? Math.PI * 2 : Math.max(0.4, sweep)));
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // waves while tapping
    if (phase === 'tapping') {
      const cycle = (t % 1100) / 1100;
      for (let i = 0; i < 3; i++) {
        const p = (cycle + i / 3) % 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + p * 78, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(45, 238, 252, ${0.4 * (1 - p)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // card — floats above pad, glides down on tap
    const hover = phase === 'idle' ? Math.sin(t / 1100) * 4 : 0;
    const cardY = phase === 'idle' ? cy - 108 + hover : cy - 66;
    const cardW = 168;
    const cardH = 100;
    const tilt = phase === 'idle' ? Math.sin(t / 1400) * 0.02 : 0;

    ctx.save();
    ctx.translate(cx, cardY);
    ctx.rotate(tilt);

    // card body — dark glass with gradient edge
    const cardGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, cardH / 2);
    if (phase === 'accepted') {
      cardGrad.addColorStop(0, 'rgba(47, 230, 200, 0.25)');
      cardGrad.addColorStop(1, 'rgba(27, 138, 143, 0.3)');
    } else {
      cardGrad.addColorStop(0, 'rgba(30, 46, 146, 0.55)');
      cardGrad.addColorStop(1, 'rgba(11, 14, 34, 0.9)');
    }
    ctx.beginPath();
    ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.strokeStyle = phase === 'accepted' ? '#2fe6c8' : 'rgba(124, 244, 238, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // chip contacts
    ctx.beginPath();
    ctx.roundRect(-cardW / 2 + 18, -cardH / 2 + 20, 24, 18, 4);
    ctx.strokeStyle = 'rgba(168, 230, 250, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-cardW / 2 + 18, -cardH / 2 + 29);
    ctx.lineTo(-cardW / 2 + 42, -cardH / 2 + 29);
    ctx.moveTo(-cardW / 2 + 30, -cardH / 2 + 20);
    ctx.lineTo(-cardW / 2 + 30, -cardH / 2 + 38);
    ctx.stroke();

    // contactless glyph
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cardW / 2 - 30, -cardH / 2 + 28, i * 6, -Math.PI / 3, Math.PI / 3);
      ctx.strokeStyle = 'rgba(45, 238, 252, 0.8)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // card text
    ctx.fillStyle = '#dceefb';
    ctx.font = '500 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('A.E.G.I.S  /  ACCESS', -cardW / 2 + 18, cardH / 2 - 30);
    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(139, 163, 192, 0.9)';
    ctx.fillText(`ID @${CARD_NAME}`, -cardW / 2 + 18, cardH / 2 - 14);
    ctx.restore();

    // accepted ring burst
    if (phase === 'accepted') {
      const burst = (t % 800) / 800;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + burst * 70, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(47, 230, 200, ${0.6 * (1 - burst)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // caption
    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(95, 115, 146, 0.9)';
    ctx.fillText(phase === 'accepted' ? 'CARD ACCEPTED' : phase === 'tapping' ? 'READING…' : 'RFID FIELD READY', cx, h - 10);
    ctx.restore();
  }

  let phase = 'idle';
  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const loop = (t: number) => {
      drawScene(ctx, t, phase);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function tap() {
    if (state !== 'idle') return;
    state = 'tapping';
    phase = 'tapping';
    beepCard();
    setTimeout(() => {
      state = 'accepted';
      phase = 'accepted';
      beepOk();
      setTimeout(() => onTap(CARD_NAME), 700);
    }, 1400);
  }
</script>

<div class="rfid">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>
  <button
    class="btn btn-primary"
    onclick={tap}
    disabled={state !== 'idle'}
    aria-live="polite"
  >
    {#if state === 'idle'}Tap In RFID
    {:else if state === 'tapping'}Reading card…
    {:else}Access granted — @{CARD_NAME}{/if}
  </button>
</div>

<style>
  .rfid {
    display: grid;
    justify-items: center;
    gap: 16px;
  }
  canvas {
    width: 320px;
    height: 240px;
    max-width: 100%;
  }
</style>
