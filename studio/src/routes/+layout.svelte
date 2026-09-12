<script>
  import '../app.css';
  import { page } from '$app/stores';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
{#if !$page.url.pathname.startsWith('/tv')}
  <SiteFooter />
{/if}
