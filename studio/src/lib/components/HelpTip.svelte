<script>
  /**
   * A small "?" beside a field label that explains what the field is for and
   * what the compiler will do with it.
   *
   * Deliberately a real <button> rather than a hover-only affordance: hover
   * tooltips are unreachable by keyboard, invisible on touch, and announce
   * nothing to a screen reader. This opens on click or Enter, closes on Escape
   * or an outside click, and is wired to the popover with aria-describedby so
   * assistive tech reads the explanation as part of the field.
   */
  import { fieldHelp } from '$lib/help/content.js';

  /** Field id from FIELD_HELP, or pass `text` directly. */
  export let field = '';
  export let text = '';
  export let label = 'What is this?';
  /** Which side to open on when there is no room to the right. */
  export let align = 'left';

  let open = false;
  let root;
  const id = `helptip-${Math.random().toString(36).slice(2, 9)}`;

  $: body = text || fieldHelp(field);

  function toggle() { open = !open; }
  function close() { open = false; }

  function onKeydown(event) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();   // don't also close a surrounding dialog
      close();
      root?.querySelector('button')?.focus();
    }
  }

  function onWindowPointerDown(event) {
    if (open && root && !root.contains(event.target)) close();
  }
</script>

<svelte:window on:pointerdown={onWindowPointerDown} on:keydown={onKeydown} />

{#if body}
  <span class="helptip" bind:this={root}>
    <button
      type="button"
      class="helptip-trigger"
      aria-label={label}
      aria-expanded={open}
      aria-describedby={open ? id : undefined}
      on:click|stopPropagation={toggle}
    >?</button>

    {#if open}
      <span class="helptip-body" class:right={align === 'right'} id={id} role="tooltip">{body}</span>
    {/if}
  </span>
{/if}

<style>
  .helptip {
    position: relative;
    display: inline-flex;
    vertical-align: middle;
    margin-left: 0.35rem;
  }

  .helptip-trigger {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 1px solid var(--border-dim, rgba(255, 255, 255, 0.14));
    background: transparent;
    color: var(--ink-muted, #8b8b93);
    font-size: 0.62rem;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    transition: color 0.15s, border-color 0.15s;
  }
  .helptip-trigger:hover,
  .helptip-trigger[aria-expanded='true'] {
    color: #fff;
    border-color: #7b5cf0;
  }
  .helptip-trigger:focus-visible {
    outline: 2px solid #7b5cf0;
    outline-offset: 2px;
  }

  /* Absolutely positioned so opening never reflows the form under the cursor. */
  .helptip-body {
    position: absolute;
    top: calc(100% + 0.45rem);
    left: -0.25rem;
    z-index: 40;
    width: max-content;
    max-width: 19rem;
    padding: 0.6rem 0.7rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(123, 92, 240, 0.28);
    background: rgba(12, 10, 18, 0.97);
    backdrop-filter: blur(10px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
    color: var(--ink-secondary, #c9c9d1);
    font-size: 0.72rem;
    line-height: 1.55;
    font-weight: 400;
    white-space: normal;
    text-transform: none;
    letter-spacing: normal;
  }
  .helptip-body.right { left: auto; right: -0.25rem; }

  @media (prefers-reduced-motion: reduce) {
    .helptip-trigger { transition: none; }
  }
</style>
