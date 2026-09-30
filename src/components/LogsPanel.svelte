<script lang="ts">
  import type { LogEntry } from '../lib/types';

  interface Props {
    logs: LogEntry[];
    title?: string;
    compact?: boolean;
  }
  let { logs, title = 'Event Log', compact = false }: Props = $props();

  const levelMeta: Record<string, { color: string; glyph: string }> = {
    info: { color: 'var(--aqua)', glyph: '·' },
    warn: { color: 'var(--warn)', glyph: '▲' },
    danger: { color: 'var(--danger)', glyph: '■' },
    system: { color: 'var(--text-faint)', glyph: '›' },
  };

  function time(at: string): string {
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? at : d.toLocaleTimeString('en-GB', { hour12: false });
  }
</script>

<div class="logs panel-strong" class:compact>
  <div class="logs-head">
    <h3>{title}</h3>
    <span class="logs-count mono">{logs.length}</span>
  </div>
  <ul class="logs-list" aria-live="polite">
    {#if logs.length === 0}
      <li class="empty">No events recorded — the guardian is watching.</li>
    {/if}
    {#each logs as log (log.id)}
      <li class="entry">
        <span class="glyph" style="color: {levelMeta[log.level]?.color ?? 'var(--text-faint)'}" aria-hidden="true">
          {levelMeta[log.level]?.glyph ?? '·'}
        </span>
        <span class="msg">{log.message}</span>
        <time class="mono">{time(log.at)}</time>
      </li>
    {/each}
  </ul>
</div>

<style>
  .logs {
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 14px 16px;
    min-height: 0;
  }
  .logs-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    margin: 0;
    flex: 1;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .logs-count {
    font-size: 0.68rem;
    color: var(--accent);
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    padding: 1px 9px;
  }
  .logs-list {
    list-style: none;
    margin: 0;
    padding: 8px 0 0;
    overflow-y: auto;
    display: grid;
    gap: 2px;
    align-content: start;
    max-height: 100%;
  }
  .compact .logs-list { max-height: 300px; }
  .entry {
    display: grid;
    grid-template-columns: 14px 1fr auto;
    gap: 9px;
    align-items: baseline;
    padding: 6px 8px;
    border-radius: 6px;
    border-left: 1px solid transparent;
  }
  .entry:hover { background: rgba(168, 230, 250, 0.05); }
  .glyph { font-size: 0.8rem; line-height: 1.4; }
  .msg {
    font-size: 0.8rem;
    color: var(--text);
    line-height: 1.45;
  }
  time {
    font-size: 0.68rem;
    color: var(--text-faint);
  }
  .empty {
    font-size: 0.8rem;
    color: var(--text-faint);
    text-align: center;
    padding: 26px 0;
  }
</style>
