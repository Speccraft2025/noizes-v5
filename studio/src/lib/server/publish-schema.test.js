import { describe, expect, it } from 'vitest';
import { findPublishSchemaError, publishSchemaMessage } from './publish-schema.js';

function clientWith(errors = {}) {
  return {
    from(table) {
      return {
        select() {
          return {
            async limit() { return { error: errors[table] || null }; },
          };
        },
      };
    },
  };
}

describe('publish schema preflight', () => {
  it('passes when every normalized publish relation is queryable', async () => {
    await expect(findPublishSchemaError(clientWith())).resolves.toBeNull();
  });

  it('turns schema drift into an actionable migration error', async () => {
    const failure = await findPublishSchemaError(clientWith({
      releases: { message: "Could not find the 'catalogue_number' column" },
    }));
    expect(failure.table).toBe('releases');
    expect(publishSchemaMessage(failure)).toContain('multi-track-phase-1-2026-07-31.sql');
    expect(publishSchemaMessage(failure)).toContain("Could not find the 'catalogue_number' column");
  });
});
