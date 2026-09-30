<script lang="ts">
  import { onMount } from 'svelte';
  import { sim } from './lib/sim';
  import type { SessionUser } from './lib/types';
  import Dashboard from './views/Dashboard.svelte';
  import Landing from './views/Landing.svelte';

  let user = $state<SessionUser | null>(null);

  onMount(() => {
    sim.start();
  });

  function enter(u: SessionUser) {
    user = u;
    sim.noteSystem(
      u.method === 'rfid'
        ? `@${u.name} tapped in with an RFID card.`
        : 'Guest session started — dashboard is running on simulated sensors.',
    );
  }

  function exit() {
    sim.noteSystem(`@${user?.name ?? 'guest'} signed out.`);
    user = null;
  }
</script>

{#if user}
  <Dashboard {user} onExit={exit} />
{:else}
  <Landing onEnter={enter} />
{/if}
