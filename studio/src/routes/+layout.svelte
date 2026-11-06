<script>
  import '../app.css';
  import SiteFooter from '#lib/components/SiteFooter.svelte';
  import { page } from '$app/state';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
{#if !$page.url.pathname.startsWith('/studio')}
  <SiteFooter />
{/if}
