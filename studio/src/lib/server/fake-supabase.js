/**
 * A tiny in-memory stand-in for the Supabase client, for tests only.
 *
 * The publish path's guarantees — no duplicate release on a double-click, no
 * second package row for the same bytes, a failed step leaving a draft rather
 * than a live release — are all about what ends up in the tables. Asserting
 * them against a mock that records calls would test the calls, not the
 * outcome, so this keeps real rows and lets tests read them back.
 *
 * Supports exactly the query shapes $lib/server/publish-release.js uses. It is
 * not a Postgres emulator: unique constraints are declared per table, and
 * anything else is out of scope on purpose.
 */

function matches(row, filters) {
  return filters.every(([column, value]) => row[column] === value);
}

class Query {
  constructor(db, table, mode, payload) {
    this.db = db;
    this.table = table;
    this.mode = mode;
    this.payload = payload;
    this.filters = [];
    this.ordering = null;
    this.limitCount = null;
    this.selected = false;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.ordering = { column, ascending };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  select() {
    this.selected = true;
    return this;
  }

  rows() {
    const rows = this.db.rows(this.table).filter((row) => matches(row, this.filters));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows.sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    return this.limitCount == null ? rows : rows.slice(0, this.limitCount);
  }

  async run() {
    const failure = this.db.failureFor(this.table, this.mode);
    if (failure) return { data: null, error: failure };

    if (this.mode === 'select') return { data: this.rows(), error: null };

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
      const written = [];
      for (const row of incoming) {
        const result = this.db.write(this.table, row, this.mode);
        if (result.error) return { data: null, error: result.error };
        written.push(result.row);
      }
      return { data: written, error: null };
    }

    if (this.mode === 'update') {
      const updated = this.rows().map((row) => Object.assign(row, this.payload));
      return { data: updated, error: null };
    }

    if (this.mode === 'delete') {
      const doomed = new Set(this.rows());
      this.db.tables.set(this.table, this.db.rows(this.table).filter((row) => !doomed.has(row)));
      return { data: [...doomed], error: null };
    }

    throw new Error(`unsupported mode ${this.mode}`);
  }

  async maybeSingle() {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    return { data: data[0] ?? null, error: null };
  }

  async single() {
    const { data, error } = await this.run();
    if (error) return { data: null, error };
    if (!data.length) return { data: null, error: { code: 'PGRST116', message: 'no rows returned' } };
    return { data: data[0], error: null };
  }

  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
}

class Table {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  select() { return new Query(this.db, this.name, 'select'); }
  insert(payload) { return new Query(this.db, this.name, 'insert', payload); }
  upsert(payload, options = {}) {
    const query = new Query(this.db, this.name, 'upsert', payload);
    query.onConflict = options.onConflict;
    return query;
  }
  update(payload) { return new Query(this.db, this.name, 'update', payload); }
  delete() { return new Query(this.db, this.name, 'delete'); }
}

export class FakeSupabase {
  /**
   * @param {object} options
   * @param {Record<string, string[][]>} [options.unique] per-table unique key
   *   column sets, e.g. { release_slugs: [['artist_slug', 'slug']] }
   */
  constructor({ unique = {}, seed = {} } = {}) {
    this.tables = new Map(Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
    this.unique = unique;
    this.failures = [];
    this.rpcCalls = [];
    this.idCounter = 0;
  }

  rows(table) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table);
  }

  from(table) {
    return new Table(this, table);
  }

  async rpc(name, args) {
    this.rpcCalls.push({ name, args });
    return { data: null, error: null };
  }

  /** Make the next matching operation fail, once. */
  failNext(table, mode, error = { code: '500', message: 'simulated failure' }) {
    this.failures.push({ table, mode, error });
  }

  failureFor(table, mode) {
    const index = this.failures.findIndex((failure) => failure.table === table && failure.mode === mode);
    if (index === -1) return null;
    const [failure] = this.failures.splice(index, 1);
    return failure.error;
  }

  write(table, row, mode) {
    const keys = this.unique[table] ?? (this.rows(table).length || row.id ? [['id']] : []);
    const record = { ...row };
    if (record.id === undefined && keys.some((key) => key.includes('id'))) {
      record.id = `${table}-${++this.idCounter}`;
    }
    if (record.created_at === undefined) record.created_at = new Date().toISOString();

    for (const key of keys) {
      if (key.some((column) => record[column] === undefined)) continue;
      const existing = this.rows(table).find((candidate) => key.every((column) => candidate[column] === record[column]));
      if (!existing) continue;
      if (mode === 'upsert') {
        Object.assign(existing, record);
        return { row: existing, error: null };
      }
      return {
        row: null,
        error: {
          code: '23505',
          message: `duplicate key value violates unique constraint "${table}_${key.join('_')}_key"`,
        },
      };
    }

    this.rows(table).push(record);
    return { row: record, error: null };
  }
}
