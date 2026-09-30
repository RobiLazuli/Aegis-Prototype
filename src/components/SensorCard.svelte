<script lang="ts">
  import type { RoomStatus } from '../lib/types';

  interface Props {
    label: string;
    value: string;
    unit?: string;
    state?: RoomStatus | 'neutral';
    hint?: string;
    fill?: number;
  }
  let { label, value, unit = '', state = 'neutral', hint = '', fill = 0.4 }: Props = $props();

  const stateColor: Record<string, string> = {
    neutral: 'var(--text-faint)',
    normal: 'var(--ok)',
    abnormal: 'var(--warn)',
    danger: 'var(--danger)',
  };
</script>

<div class="sensor panel-strong">
  <div class="sensor-top">
    <span class="sensor-label">{label}</span>
    <span class="sensor-dot dot" style="background: {stateColor[state]}; box-shadow: 0 0 8px {stateColor[state]}"></span>
  </div>
  <div class="sensor-value mono">
    {value}{#if unit}<small>{unit}</small>{/if}
  </div>
  <div class="sensor-track" aria-hidden="true">
    <div class="sensor-fill" style="background: {stateColor[state]}; width: {Math.round(fill * 100)}%"></div>
    <span class="sensor-threshold" style="left: 66%"></span>
  </div>
  {#if hint}<div class="sensor-hint">{hint}</div>{/if}
</div>

<style>
  .sensor {
    padding: 14px 16px;
    display: grid;
    gap: 9px;
    align-content: start;
    min-width: 0;
  }
  .sensor-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sensor-label {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.24em;
    color: var(--text-faint);
    text-transform: uppercase;
  }
  .sensor-dot { width: 6px; height: 6px; }
  .sensor-value {
    font-size: 1.65rem;
    font-weight: 500;
    line-height: 1;
    color: var(--text);
  }
  .sensor-value small {
    font-size: 0.78rem;
    margin-left: 5px;
    color: var(--text-dim);
    font-weight: 400;
  }
  .sensor-track {
    position: relative;
    height: 3px;
    border-radius: 999px;
    background: rgba(168, 230, 250, 0.12);
  }
  .sensor-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 600ms ease, background 600ms ease;
    opacity: 0.85;
  }
  .sensor-threshold {
    position: absolute;
    top: -2.5px;
    width: 1px;
    height: 8px;
    background: rgba(139, 163, 192, 0.5);
  }
  .sensor-hint {
    font-size: 0.72rem;
    color: var(--text-dim);
    letter-spacing: 0.02em;
  }
</style>
