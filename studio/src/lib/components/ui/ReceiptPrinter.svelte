<script>
  import { onMount } from 'svelte';

  export let title = '';
  export let artist = '';
  export let edition = '';
  export let price = '';
  export let date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  export let transactionId = '';
  export let items = [];

  let visible = false;
  let printed = false;

  onMount(() => {
    const timer = setTimeout(() => { visible = true; }, 200);
    const print = setTimeout(() => { printed = true; }, 1200);
    return () => { clearTimeout(timer); clearTimeout(print); };
  });
</script>

<div class="receipt-wrapper" class:visible>
  <div class="receipt-paper" class:printed>
    <div class="receipt-tear" aria-hidden="true"></div>

    <div class="receipt-content">
      <div class="receipt-header">
        <p class="receipt-logo">NOIZES</p>
        <p class="receipt-sub">Authentic Music Exchange</p>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-body">
        <div class="receipt-row">
          <span class="receipt-label">ITEM</span>
          <span class="receipt-value">{title}</span>
        </div>
        {#if artist}
          <div class="receipt-row">
            <span class="receipt-label">ARTIST</span>
            <span class="receipt-value">{artist}</span>
          </div>
        {/if}
        {#if edition}
          <div class="receipt-row">
            <span class="receipt-label">EDITION</span>
            <span class="receipt-value">{edition}</span>
          </div>
        {/if}
        {#each items as item}
          <div class="receipt-row">
            <span class="receipt-label">{item.label}</span>
            <span class="receipt-value">{item.value}</span>
          </div>
        {/each}
      </div>

      <div class="receipt-divider dashed"></div>

      {#if price}
        <div class="receipt-total">
          <span>TOTAL</span>
          <span class="receipt-price">{price}</span>
        </div>
      {/if}

      <div class="receipt-divider"></div>

      <div class="receipt-footer">
        <p class="receipt-date">{date}</p>
        {#if transactionId}
          <p class="receipt-txn">TXN: {transactionId}</p>
        {/if}
        <div class="receipt-barcode" aria-hidden="true">
          {#each Array(32) as _, i}
            <span class="bar" style="width:{[1,2,3][i%3]}px;"></span>
          {/each}
        </div>
        <p class="receipt-thanks">Thank you for your support</p>
      </div>
    </div>

    <div class="receipt-tear bottom" aria-hidden="true"></div>
  </div>
</div>

<style>
  .receipt-wrapper {
    display: flex;
    justify-content: center;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.4s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .receipt-wrapper.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .receipt-paper {
    position: relative;
    width: 100%;
    max-width: 320px;
    background: #fafaf8;
    color: #1a1a1a;
    font-family: 'Courier New', 'Courier', monospace;
    overflow: hidden;
    max-height: 60px;
    transition: max-height 1s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .receipt-paper.printed {
    max-height: 600px;
  }

  .receipt-content {
    padding: 24px 20px;
  }

  .receipt-tear {
    height: 12px;
    background: repeating-linear-gradient(
      90deg,
      transparent 0,
      transparent 6px,
      #fafaf8 6px,
      #fafaf8 12px
    );
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 12L12 0L24 12' fill='white'/%3E%3C/svg%3E");
    mask-size: 24px 12px;
    mask-repeat: repeat-x;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='12'%3E%3Cpath d='M0 12L12 0L24 12' fill='white'/%3E%3C/svg%3E");
    -webkit-mask-size: 24px 12px;
    -webkit-mask-repeat: repeat-x;
    background: #fafaf8;
  }

  .receipt-tear.bottom {
    transform: scaleY(-1);
  }

  .receipt-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .receipt-logo {
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 0.25em;
    color: #050505;
    margin: 0;
  }

  .receipt-sub {
    font-size: 0.55rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #888;
    margin: 4px 0 0;
  }

  .receipt-divider {
    border: none;
    border-top: 1px solid #ddd;
    margin: 12px 0;
  }

  .receipt-divider.dashed {
    border-top-style: dashed;
  }

  .receipt-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .receipt-label {
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: #999;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .receipt-value {
    font-size: 0.7rem;
    font-weight: 700;
    color: #1a1a1a;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .receipt-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 8px 0;
    font-size: 0.7rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    color: #050505;
  }

  .receipt-price {
    font-size: 0.9rem;
  }

  .receipt-footer {
    text-align: center;
    padding-top: 4px;
  }

  .receipt-date {
    font-size: 0.55rem;
    color: #999;
    margin: 0 0 4px;
  }

  .receipt-txn {
    font-size: 0.5rem;
    color: #bbb;
    letter-spacing: 0.05em;
    margin: 0 0 12px;
  }

  .receipt-barcode {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 1px;
    height: 28px;
    margin: 0 auto 12px;
    max-width: 140px;
  }

  .bar {
    display: inline-block;
    height: 100%;
    background: #1a1a1a;
  }

  .bar:nth-child(3n) { height: 80%; }
  .bar:nth-child(5n) { height: 60%; }

  .receipt-thanks {
    font-size: 0.55rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #aaa;
    margin: 0;
  }
</style>
