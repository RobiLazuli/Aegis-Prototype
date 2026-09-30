<script lang="ts">
  import AuroraCanvas from '../components/AuroraCanvas.svelte';
  import ShieldCanvas from '../components/ShieldCanvas.svelte';
  import RfidTap from '../components/RfidTap.svelte';
  import LogsPanel from '../components/LogsPanel.svelte';
  import { sim } from '../lib/sim';
  import type { SessionUser } from '../lib/types';

  interface Props {
    onEnter: (user: SessionUser) => void;
  }
  let { onEnter }: Props = $props();

  let modal = $state<'none' | 'team' | 'about' | 'logs'>('none');
  let showRfid = $state(false);

  function tapped(cardName: string) {
    onEnter({ name: cardName, method: 'rfid' });
  }
</script>

<div class="landing">
  <AuroraCanvas />

  <header class="topbar">
    <div class="wordmark">
      <ShieldCanvas size={30} animated={false} />
      <span>A·E·G·I·S</span>
    </div>
    <nav>
      <button class="btn btn-ghost btn-sm" onclick={() => (modal = 'team')}>Team</button>
      <button class="btn btn-ghost btn-sm" onclick={() => (modal = 'about')}>About</button>
    </nav>
  </header>

  <main class="hero">
    <section class="hero-inner">
      <div class="hero-shield">
        <ShieldCanvas size={150} />
      </div>
      <p class="eyebrow mono">ROOM SECURITY OPERATIONS CONSOLE</p>
      <h1>A.E.G.I.S</h1>
      <p class="tagline">
        Alliance Environment Guardian Information System
      </p>
      <p class="sub">
        One room under four senses — temperature, gas, door and camera —
        with Telegram alerts the moment conditions turn abnormal.
      </p>

      {#if !showRfid}
        <div class="cta">
          <button class="btn btn-primary" onclick={() => (showRfid = true)}>Tap In RFID</button>
          <button class="btn" onclick={() => (modal = 'logs')}>View Log</button>
        </div>
        <button class="guest-link" onclick={() => onEnter({ name: 'guest', method: 'guest' })}>
          or continue as guest — simulated sensor feed →
        </button>
      {:else}
        <div class="tap-area panel">
          <RfidTap onTap={tapped} />
          <button class="guest-link" onclick={() => onEnter({ name: 'guest', method: 'guest' })}>
            no card? continue as guest →
          </button>
        </div>
      {/if}
    </section>
  </main>

  <footer class="foot mono">
    <span>A.E.G.I.S v0.2 · an innovation from Project SOC</span>
  </footer>

  {#if modal === 'team'}
    <div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (modal = 'none')}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Dev team">
        <button class="close-x" onclick={() => (modal = 'none')} aria-label="Close">×</button>
        <h2>Dev Team</h2>
        <p class="modal-sub">The alliance behind the guardian.</p>
        <ul class="team-list">
          <li><span class="role mono">FIRMWARE</span> ESP32 sensor node — DHT temp, MQ gas, door reed, RFID reader</li>
          <li><span class="role mono">FRONTEND</span> This console — hand-drawn canvas UI, Svelte + TypeScript</li>
          <li><span class="role mono">BACKEND</span> Cloud ingest, event log and the Telegram relay</li>
          <li><span class="role mono">RESEARCH</span> Thresholds, room-safety model and Project SOC heritage</li>
        </ul>
      </div>
    </div>
  {:else if modal === 'about'}
    <div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (modal = 'none')}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="About the project">
        <button class="close-x" onclick={() => (modal = 'none')} aria-label="Close">×</button>
        <h2>About A.E.G.I.S</h2>
        <p class="modal-sub">Alliance Environment Guardian Information System</p>
        <p>
          A.E.G.I.S is a room-security monitor that watches temperature, gas/smoke, the door
          and a camera from one console. It grew out of <strong>Project SOC</strong>, our earlier
          room-guardian prototype, and turns it into a connected system.
        </p>
        <p>
          When the room turns <strong>abnormal</strong> or <strong>dangerous</strong>, the room monitor
          pushes a message straight to the team's Telegram group — no one has to be staring at
          the console for the room to be heard.
        </p>
      </div>
    </div>
  {:else if modal === 'logs'}
    <div class="modal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (modal = 'none')}>
      <div class="modal" role="dialog" aria-modal="true" aria-label="Recent room log">
        <button class="close-x" onclick={() => (modal = 'none')} aria-label="Close">×</button>
        <h2>Room Log</h2>
        <p class="modal-sub">Latest events from the simulation feed.</p>
        <LogsPanel logs={$sim.logs} title="Events" compact />
      </div>
    </div>
  {/if}
</div>

<style>
  .landing {
    position: relative;
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    background: var(--bg-0);
  }
  .topbar {
    position: relative;
    z-index: 2;
    width: min(1120px, calc(100% - 40px));
    margin: 0 auto;
    padding: 18px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
  }
  .wordmark {
    display: flex;
    align-items: center;
    gap: 11px;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.95rem;
    letter-spacing: 0.3em;
    color: var(--text);
    white-space: nowrap;
  }
  nav { display: flex; gap: 4px; }
  .hero {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 30px 20px;
  }
  .hero-inner {
    display: grid;
    justify-items: center;
    gap: 12px;
    text-align: center;
    max-width: 640px;
    animation: rise 600ms ease backwards;
  }
  @keyframes rise {
    from { transform: translateY(14px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .eyebrow {
    margin: 0;
    font-size: 0.66rem;
    letter-spacing: 0.34em;
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-weight: 300;
    font-size: clamp(3.2rem, 10vw, 5.4rem);
    letter-spacing: 0.22em;
    line-height: 1;
    background: linear-gradient(120deg, #eafffe 30%, #7cf4ee 60%, #2e9be6 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tagline {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: 1rem;
    letter-spacing: 0.1em;
    color: var(--text);
  }
  .sub {
    margin: 0;
    max-width: 52ch;
    font-size: 0.9rem;
    color: var(--text-dim);
    line-height: 1.6;
  }
  .cta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 14px;
  }
  .guest-link {
    margin-top: 6px;
    background: none;
    border: none;
    padding: 6px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    color: var(--text-faint);
    transition: color 140ms ease;
  }
  .guest-link:hover { color: var(--accent); }
  .tap-area {
    margin-top: 14px;
    padding: 20px 26px 14px;
    display: grid;
    justify-items: center;
    gap: 4px;
  }
  .foot {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 16px;
    color: var(--text-faint);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
  }
  .modal-sub {
    margin: 0 0 16px;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  .team-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .team-list li {
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    background: rgba(168, 230, 250, 0.03);
    padding: 11px 13px;
    font-size: 0.85rem;
    color: var(--text);
    line-height: 1.5;
  }
  .role {
    display: inline-block;
    color: var(--accent);
    margin-right: 10px;
    font-size: 0.66rem;
    letter-spacing: 0.18em;
  }
  .modal p { line-height: 1.65; font-size: 0.9rem; color: var(--text-dim); }
  .modal p strong { color: var(--text); }
</style>
