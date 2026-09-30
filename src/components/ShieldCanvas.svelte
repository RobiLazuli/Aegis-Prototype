<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    size?: number;
    animated?: boolean;
  }
  let { size = 120, animated = true }: Props = $props();

  let canvas: HTMLCanvasElement;

  function shieldPath(cx: number, top: number, sw: number, s: number): Path2D {
    const left = cx - sw / 2;
    const midY = top + s * 0.46;
    const botY = top + s * 0.86;
    const p = new Path2D();
    p.moveTo(cx, top);
    p.lineTo(left + sw, top + s * 0.11);
    p.lineTo(left + sw, midY);
    p.bezierCurveTo(left + sw, midY + s * 0.24, cx, botY, cx, botY);
    p.bezierCurveTo(cx, botY, left, midY + s * 0.24, left, midY);
    p.lineTo(left, top + s * 0.11);
    p.closePath();
    return p;
  }

  function draw(ctx: CanvasRenderingContext2D, t: number) {
    const dpr = window.devicePixelRatio || 1;
    const w = ctx.canvas.width / dpr;
    const h = ctx.canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);

    const s = size;
    const cx = w / 2;
    const top = (h - s * 0.86) / 2;
    const cy = top + s * 0.42;

    // halo
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.62);
    halo.addColorStop(0, 'rgba(45, 238, 252, 0.14)');
    halo.addColorStop(1, 'rgba(45, 238, 252, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // outer shield — gradient stroke
    const outer = shieldPath(cx, top, s * 0.8, s);
    const strokeGrad = ctx.createLinearGradient(cx - s * 0.4, top, cx + s * 0.4, top + s);
    strokeGrad.addColorStop(0, '#2deefc');
    strokeGrad.addColorStop(1, '#2743d6');
    ctx.strokeStyle = strokeGrad;
    ctx.lineWidth = Math.max(1.6, s * 0.022);
    ctx.lineJoin = 'round';
    ctx.stroke(outer);

    // inner shield — faint fill
    const inner = shieldPath(cx, top + s * 0.09, s * 0.62, s * 0.78);
    ctx.save();
    ctx.clip(inner);
    const fillGrad = ctx.createLinearGradient(cx, top, cx, top + s);
    fillGrad.addColorStop(0, 'rgba(124, 244, 238, 0.16)');
    fillGrad.addColorStop(1, 'rgba(39, 67, 214, 0.10)');
    ctx.fillStyle = fillGrad;
    ctx.fillRect(0, 0, w, h);
    // scan sweep inside shield
    if (animated) {
      const sweepY = top + ((t / 18) % (s * 1.3)) - s * 0.2;
      const sg = ctx.createLinearGradient(0, sweepY - s * 0.08, 0, sweepY + s * 0.08);
      sg.addColorStop(0, 'rgba(124, 244, 238, 0)');
      sg.addColorStop(0.5, 'rgba(124, 244, 238, 0.16)');
      sg.addColorStop(1, 'rgba(124, 244, 238, 0)');
      ctx.fillStyle = sg;
      ctx.fillRect(cx - s * 0.5, sweepY - s * 0.08, s, s * 0.16);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(124, 244, 238, 0.5)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.stroke(inner);

    // breathing core diamond
    const breathe = animated ? 1 + Math.sin(t / 800) * 0.12 : 1;
    const cr = s * 0.075 * breathe;
    ctx.beginPath();
    ctx.moveTo(cx, cy - cr);
    ctx.lineTo(cx + cr, cy);
    ctx.lineTo(cx, cy + cr);
    ctx.lineTo(cx - cr, cy);
    ctx.closePath();
    ctx.fillStyle = '#7cf4ee';
    ctx.shadowColor = '#2deefc';
    ctx.shadowBlur = s * 0.09;
    ctx.fill();
    ctx.shadowBlur = 0;

    // core orbit ring
    if (animated) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.17, s * 0.17 * 0.42, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(124, 244, 238, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const a = t / 900;
      const ox = cx + Math.cos(a) * s * 0.17;
      const oy = cy + Math.sin(a) * s * 0.17 * 0.42;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(1.4, s * 0.014), 0, Math.PI * 2);
      ctx.fillStyle = '#a8e6fa';
      ctx.fill();
    }
    ctx.restore();
  }

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!animated) {
      draw(ctx, 0);
      return;
    }
    let raf = 0;
    const loop = (t: number) => {
      draw(ctx, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<span role="img" aria-label="A.E.G.I.S shield emblem"><canvas bind:this={canvas} aria-hidden="true"></canvas></span>
