import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const componentUrl = new URL('./+page.svelte', import.meta.url);
const viteConfigUrl = new URL('../../../../vite.config.js', import.meta.url);

describe('Exchange server rendering', () => {
  it('enables the explicit environment variables used by server routes', () => {
    const viteConfig = readFileSync(viteConfigUrl, 'utf8');

    expect(viteConfig).toMatch(/explicitEnvironmentVariables\s*:\s*true/);
  });

  it('defines navigation state for the loading markup without the removed store API', () => {
    const { instance } = parse(readFileSync(componentUrl, 'utf8'));
    const statements = instance.content.body;
    const declaresNavigationState = statements.some((statement) =>
      statement.type === 'VariableDeclaration' &&
      statement.declarations.some((declaration) => declaration.id.name === 'isNavigatingExchange')
    );
    const tracksNavigationCompletion = statements.some(
      (statement) =>
        statement.type === 'FunctionDeclaration' &&
        statement.id.name === 'navigateExchange' &&
        statement.body.body.some((node) => node.type === 'TryStatement')
    );

    expect(declaresNavigationState).toBe(true);
    expect(tracksNavigationCompletion).toBe(true);
  });
});
