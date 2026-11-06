<script>
  import '../app.css';
  import SiteFooter from '#lib/components/SiteFooter.svelte';
  // This layout is written in legacy Svelte syntax, so `page` must be a
  // subscribable store. `$app/state` exposes a rune-only value, and using it
  // with `$page` makes server-side rendering throw before Studio can load.
  import { page } from '$app/stores';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
{#if !$page.url.pathname.startsWith('/studio')}
  <SiteFooter />
{/if}
