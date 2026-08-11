<script>
  import '../app.css';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
<SiteFooter />
