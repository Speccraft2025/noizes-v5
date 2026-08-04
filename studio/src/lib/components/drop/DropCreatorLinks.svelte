<script>
  // Understated on purpose. A Drop Page that becomes a stack of buttons to
  // other platforms has quietly changed what it is for; the object stays the
  // subject and these sit beneath it.
  export let links = [];

  // Belt and braces: the database constrains url to https, the manage endpoint
  // validates it, and the component still refuses anything else before it
  // reaches an href.
  function safe(url) {
    try {
      return new URL(url).protocol === 'https:' ? url : null;
    } catch {
      return null;
    }
  }

  $: visible = links.map((link) => ({ ...link, href: safe(link.url) })).filter((link) => link.href);
</script>

{#if visible.length}
  <section aria-labelledby="drop-links-heading" class="space-y-4">
    <h2 id="drop-links-heading" class="t-caption">From the creator</h2>
    <ul class="flex flex-wrap gap-2">
      {#each visible as link (link.id)}
        <li>
          <a
            class="btn-ghost rounded-full px-4 py-2 text-xs"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >{link.label} <span aria-hidden="true">↗</span></a>
        </li>
      {/each}
    </ul>
  </section>
{/if}
