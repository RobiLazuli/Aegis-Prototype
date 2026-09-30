<script lang="ts">
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(t: number) {
      ctx!.clearRect(0, 0, width, height);

      // aurora wash
      const a1 = ctx!.createRadialGradient(
        width * 0.22 + Math.sin(t / 9000) * 60, height * 0.18, 0,
        width * 0.22, height * 0.18, Math.max(width, height) * 0.55,
      );
      a1.addColorStop(0, 'rgba(39, 67, 214, 0.20)');
      a1.addColorStop(1, 'rgba(39, 67, 214, 0)');
      ctx!.fillStyle = a1;
      ctx!.fillRect(0, 0, width, height);

      const a2 = ctx!.createRadialGradient(
        width * 0.82, height * 0.78 + Math.cos(t / 11000) * 50, 0,
        width * 0.82, height * 0.78, Math.max(width, height) * 0.5,
      );
      a2.addColorStop(0, 'rgba(27, 138, 143, 0.16)');
      a2.addColorStop(1, 'rgba(27, 138, 143, 0)');
      ctx!.fillStyle = a2;
      ctx!.fillRect(0, 0, width, height);

      // fine grid
      const step = 44;
      const offset = (t / 90) % step;
      ctx!.strokeStyle = 'rgba(124, 244, 238, 0.05)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let x = -offset; x <= width; x += step) {
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, height);
      }
      for (let y = -offset; y <= height; y += step) {
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
      }
      ctx!.stroke();

      // grid nodes shimmer
      for (let x = 0; x <= width; x += step * 3) {
        for (let y = 0; y <= height; y += step * 3) {
          const tw = Math.sin(t / 1400 + x * 0.7 + y * 1.3);
          if (tw > 0.86) {
            ctx!.beginPath();
            ctx!.arc(x, y, 1.6, 0, Math.PI * 2);
            ctx!.fillStyle = `rgba(124, 244, 238, ${(tw - 0.86) * 4})`;
            ctx!.fill();
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    let raf = 0;
    resize();
    raf = requestAnimationFrame(frame);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} class="aurora" aria-hidden="true"></canvas>

<style>
  .aurora {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
