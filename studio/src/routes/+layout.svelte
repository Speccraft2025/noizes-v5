<script>
  import '../app.css';
  export let data;
  $: ({ session, user, profile } = data);
</script>

<slot />
