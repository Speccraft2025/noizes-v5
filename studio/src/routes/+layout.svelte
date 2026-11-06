<script>
  import '../app.css';
  import SiteFooter from '#lib/components/SiteFooter.svelte';
  // `page` is SvelteKit state, not a subscribable store. The legacy `$page`
  // auto-subscription crashes SSR; `$app/stores` was removed in SvelteKit 3.
  import { page } from '$app/state';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
{#if !page.url.pathname.startsWith('/studio')}
  <SiteFooter />
{/if}
