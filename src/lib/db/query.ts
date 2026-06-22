/**
 * QueryBuilder — replicates the surface of `@supabase/supabase-js`'s
 * PostgrestQueryBuilder / PostgrestFilterBuilder, but executes against
 * the local SQLite database through Tauri.
 *
 * The shape returned by `await builder` mirrors what the original
 * Supabase client returns, so React components consume it unchanged:
 *
 *   {
 *     data: T | T[] | null,
 *     error: { message: string; code?: string; details?: string } | null,
 *     count: number | null,
 *     status: number,
 *     statusText: string,
 *   }
 *
 * Supported chain methods:
 *
 *   .select(columns?, { count, head })   -- triggers SELECT
 *   .insert(values, options?)            -- triggers INSERT
 *   .upsert(values, options?)            -- INSERT … ON CONFLICT DO UPDATE
 *   .update(values)                      -- triggers UPDATE
 *   .delete()                            -- triggers DELETE
 *
 *   .eq/.neq/.gt/.gte/.lt/.lte/.like/.ilike/.in/.is/.contains
 *   .not(column, op, value)              -- mirrors PostgREST `.not()`
 *   .or('a.eq.1,b.eq.2')
 *   .match({col: val, …})                -- shorthand AND of eqs
 *   .filter(column, operator, value)     -- generic
 *
 *   .order(column, { ascending, nullsFirst })
 *   .limit(n) / .range(from, to) / .offset(n)
 *   .single() / .maybeSingle()
 *   .throwOnError() / .returns<T>()      -- pass-through, no-ops other than typing
 *
 *   .csv() / .geojson() / .explain() …   -- intentionally not implemented; loud throw.
 */

import { executeQuery, fetchRows } from './runtime';
import {
  parseSelectString,
  stitchEmbedded,
  type EmbeddedSpec,
} from './relations';
import {
  Filter,
  FilterOp,
  OrderClause,
  parseOrExpr,
  quoteIdent,
  quoteIdents,
  renderFilter,
  renderLimitOffset,
  renderOrder,
  renderWhere,
  placeholders,
} from './sql';

// ---------------------------------------------------------------------------
// Response shape — matches PostgrestResponse / PostgrestSingleResponse
// ---------------------------------------------------------------------------

export interface AdapterError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface AdapterResponse<T = unknown> {
  data: T | null;
  error: AdapterError | null;
  count: number | null;
  status: number;
  statusText: string;
}

type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Builder state — what we accumulate before resolving the promise
// ---------------------------------------------------------------------------

type OpKind = 'select' | 'insert' | 'update' | 'delete' | 'upsert' | null;

interface BuilderState {
  table: string;
  op: OpKind;

  /** SELECT: the raw select string (e.g. '*, client:clients(*)'). */
  selectString: string;
  /** SELECT: { count: 'exact', head?: boolean } options. */
  countOption?: 'exact' | 'planned' | 'estimated';
  headOnly: boolean;
  /** When an insert/update/delete then re-calls .select(), we return rows. */
  returnRows: boolean;

  /** Mutating ops carry the values to write. */
  values: Row[];
  /** UPSERT options: onConflict (column name(s)). */
  onConflict?: string;
  /** UPDATE/DELETE/SELECT filters. */
  filters: Filter[];
  /** ORDER BY clauses. */
  orders: OrderClause[];
  limit?: number;
  offset?: number;

  /** `.single()` / `.maybeSingle()` modifiers. */
  expectSingle: boolean;
  allowZero: boolean;

  /** `.throwOnError()` — make awaits reject instead of returning error. */
  throwOnError: boolean;
}

function freshState(table: string): BuilderState {
  return {
    table,
    op: null,
    selectString: '*',
    headOnly: false,
    returnRows: false,
    values: [],
    filters: [],
    orders: [],
    expectSingle: false,
    allowZero: false,
    throwOnError: false,
  };
}

// ---------------------------------------------------------------------------
// QueryBuilder class
// ---------------------------------------------------------------------------

export class QueryBuilder<T = unknown> implements PromiseLike<AdapterResponse<T>> {
  private s: BuilderState;

  constructor(table: string) {
    this.s = freshState(table);
  }

  // -------------------- terminal verbs --------------------------------

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    // .select() can be called either as the leading verb (read) OR as a tail
    // after insert/update/upsert/delete to ask for the affected rows back.
    if (this.s.op === null) {
      this.s.op = 'select';
    } else {
      this.s.returnRows = true;
    }
    this.s.selectString = columns || '*';
    if (options?.count) this.s.countOption = options.count;
    if (options?.head) this.s.headOnly = true;
    return this;
  }

  insert(values: Row | Row[], _options?: { defaultToNull?: boolean }): this {
    this.s.op = 'insert';
    this.s.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean; defaultToNull?: boolean },
  ): this {
    this.s.op = 'upsert';
    this.s.values = Array.isArray(values) ? values : [values];
    if (options?.onConflict) this.s.onConflict = options.onConflict;
    return this;
  }

  update(values: Row): this {
    this.s.op = 'update';
    this.s.values = [values];
    return this;
  }

  delete(): this {
    this.s.op = 'delete';
    return this;
  }

  // -------------------- filters ---------------------------------------

  eq(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'eq', value });
    return this;
  }
  neq(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'neq', value });
    return this;
  }
  gt(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'gt', value });
    return this;
  }
  gte(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'gte', value });
    return this;
  }
  lt(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'lt', value });
    return this;
  }
  lte(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'lte', value });
    return this;
  }
  like(column: string, pattern: string): this {
    this.s.filters.push({ column, op: 'like', value: pattern });
    return this;
  }
  ilike(column: string, pattern: string): this {
    this.s.filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.s.filters.push({ column, op: 'in', value: values });
    return this;
  }
  is(column: string, value: null | boolean): this {
    this.s.filters.push({ column, op: 'is', value });
    return this;
  }
  contains(column: string, value: unknown): this {
    this.s.filters.push({ column, op: 'contains', value });
    return this;
  }
  /**
   * `.not(column, operator, value)` — Supabase signature.
   * Common forms in this codebase:
   *   .not('id', 'is', null)            -> WHERE id IS NOT NULL
   *   .not('reference', 'is', null)
   */
  not(column: string, operator: string, value: unknown): this {
    const op = `not.${operator}` as FilterOp;
    this.s.filters.push({ column, op, value });
    return this;
  }
  /**
   * Generic `.filter('col', 'op', val)`. Mirrors Supabase loosely.
   */
  filter(column: string, operator: string, value: unknown): this {
    this.s.filters.push({ column, op: operator as FilterOp, value });
    return this;
  }
  /**
   * `.match({col: val, col2: val2})` — AND of equality filters.
   */
  match(query: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(query)) {
      this.s.filters.push({ column, op: 'eq', value });
    }
    return this;
  }
  /**
   * `.or('col.eq.1,col2.ilike.%foo%')` — PostgREST-style.
   */
  or(expr: string): this {
    const { sql, params } = parseOrExpr(expr);
    this.s.filters.push({
      column: '',
      op: 'eq',
      value: null,
      raw: { sql, params },
    });
    return this;
  }

  // -------------------- ordering / paging -----------------------------

  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): this {
    this.s.orders.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }
  limit(n: number): this {
    this.s.limit = n;
    return this;
  }
  range(from: number, to: number): this {
    this.s.offset = from;
    this.s.limit = to - from + 1;
    return this;
  }
  offset(n: number): this {
    this.s.offset = n;
    return this;
  }

  // -------------------- modifiers -------------------------------------

  single(): this {
    this.s.expectSingle = true;
    this.s.allowZero = false;
    return this;
  }
  maybeSingle(): this {
    this.s.expectSingle = true;
    this.s.allowZero = true;
    return this;
  }
  throwOnError(): this {
    this.s.throwOnError = true;
    return this;
  }
  returns<U>(): QueryBuilder<U> {
    return this as unknown as QueryBuilder<U>;
  }
  csv(): never {
    throw new Error('.csv() is not supported by the local SQLite adapter');
  }

  // -------------------- thenable interface ----------------------------

  then<TResult1 = AdapterResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: AdapterResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected as never);
  }

  // -------------------- execution -------------------------------------

  private async execute(): Promise<AdapterResponse<T>> {
    try {
      switch (this.s.op) {
        case 'select':
        case null:
          return (await this.execSelect()) as AdapterResponse<T>;
        case 'insert':
          return (await this.execInsert()) as AdapterResponse<T>;
        case 'upsert':
          return (await this.execUpsert()) as AdapterResponse<T>;
        case 'update':
          return (await this.execUpdate()) as AdapterResponse<T>;
        case 'delete':
          return (await this.execDelete()) as AdapterResponse<T>;
      }
    } catch (err) {
      const e: AdapterError = {
        message: err instanceof Error ? err.message : String(err),
      };
      if (this.s.throwOnError) throw err;
      return {
        data: null,
        error: e,
        count: null,
        status: 500,
        statusText: 'Internal',
      };
    }
  }

  // ----- SELECT --------------------------------------------------------

  private async execSelect(): Promise<AdapterResponse<unknown>> {
    const parsed = parseSelectString(this.s.selectString);
    const { sql: whereSql, params: whereParams } = renderWhere(this.s.filters);
    const orderSql = renderOrder(this.s.orders);
    const lpSql = renderLimitOffset(this.s.limit, this.s.offset);

    // ---- count (parallel small query) --------------------------------
    let count: number | null = null;
    if (this.s.countOption) {
      const countSql = `SELECT COUNT(*) AS c FROM ${quoteIdent(this.s.table)}${whereSql}`;
      const r = (await fetchRows(countSql, whereParams as never)) as Array<{ c: number }>;
      count = r[0]?.c ?? 0;
    }

    // head:true → no rows requested (count-only)
    if (this.s.headOnly) {
      return {
        data: null,
        error: null,
        count,
        status: 200,
        statusText: 'OK',
      };
    }

    // ---- parent rows -------------------------------------------------
    const parentCols = renderParentColumns(parsed.parentColumns);
    const sql =
      `SELECT ${parentCols} FROM ${quoteIdent(this.s.table)}${whereSql}${orderSql}${lpSql}`;
    let rows = (await fetchRows(sql, whereParams as never)) as Row[];

    // ---- embed relations --------------------------------------------
    if (parsed.embedded.length > 0) {
      rows = await stitchEmbedded({
        parentTable: this.s.table,
        parentRows: rows,
        embedded: parsed.embedded,
        fetchRows: (s, p) => fetchRows(s, p as never) as Promise<Row[]>,
      });
    }

    return this.finalizeRead(rows, count);
  }

  // ----- INSERT --------------------------------------------------------

  private async execInsert(): Promise<AdapterResponse<unknown>> {
    if (this.s.values.length === 0) {
      return {
        data: null,
        error: { message: 'INSERT called with no rows' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      };
    }
    const columns = collectColumns(this.s.values);
    const rows = await this.insertRows(columns, /*upsert*/ false);
    return this.finalizeWrite(rows);
  }

  // ----- UPSERT --------------------------------------------------------

  private async execUpsert(): Promise<AdapterResponse<unknown>> {
    if (this.s.values.length === 0) {
      return {
        data: null,
        error: { message: 'UPSERT called with no rows' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      };
    }
    const columns = collectColumns(this.s.values);
    const rows = await this.insertRows(columns, /*upsert*/ true);
    return this.finalizeWrite(rows);
  }

  /**
   * Common path for INSERT and UPSERT. Returns the inserted rows when
   * `.select()` was chained afterwards.
   */
  private async insertRows(columns: string[], upsert: boolean): Promise<Row[]> {
    const out: Row[] = [];
    const colList = quoteIdents(columns);

    let conflictClause = '';
    if (upsert) {
      const conflictCols = this.s.onConflict
        ? this.s.onConflict.split(',').map((c) => c.trim())
        : ['id'];
      const updates = columns
        .filter((c) => !conflictCols.includes(c))
        .map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`)
        .join(', ');
      conflictClause = updates
        ? ` ON CONFLICT(${conflictCols.map(quoteIdent).join(', ')}) DO UPDATE SET ${updates}`
        : ` ON CONFLICT(${conflictCols.map(quoteIdent).join(', ')}) DO NOTHING`;
    }

    for (const row of this.s.values) {
      const params = columns.map((c) => normalize(row[c]));
      const sql = `INSERT INTO ${quoteIdent(this.s.table)} (${colList}) VALUES (${placeholders(
        columns.length,
      )})${conflictClause}`;
      const { lastInsertId } = await executeQuery(sql, params as never);

      if (this.s.returnRows || this.s.expectSingle) {
        // Fetch the freshly inserted row so the caller can see DB-generated
        // defaults / autoincrement ids.
        const fetched = await fetchRows(
          `SELECT * FROM ${quoteIdent(this.s.table)} WHERE rowid = ?`,
          [lastInsertId] as never,
        ) as Row[];
        if (fetched[0]) out.push(fetched[0]);
      }
    }
    return out;
  }

  // ----- UPDATE --------------------------------------------------------

  private async execUpdate(): Promise<AdapterResponse<unknown>> {
    const updates = this.s.values[0];
    if (!updates || Object.keys(updates).length === 0) {
      return {
        data: null,
        error: { message: 'UPDATE called with empty values' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      };
    }
    const columns = Object.keys(updates);
    const setSql = columns.map((c) => `${quoteIdent(c)} = ?`).join(', ');
    const setParams = columns.map((c) => normalize(updates[c]));
    const { sql: whereSql, params: whereParams } = renderWhere(this.s.filters);
    const sql = `UPDATE ${quoteIdent(this.s.table)} SET ${setSql}${whereSql}`;

    await executeQuery(sql, [...setParams, ...whereParams] as never);

    // If .select() was chained on, re-read the affected rows now.
    let rows: Row[] = [];
    if (this.s.returnRows || this.s.expectSingle) {
      const readSql = `SELECT * FROM ${quoteIdent(this.s.table)}${whereSql}`;
      rows = (await fetchRows(readSql, whereParams as never)) as Row[];
    }
    return this.finalizeWrite(rows);
  }

  // ----- DELETE --------------------------------------------------------

  private async execDelete(): Promise<AdapterResponse<unknown>> {
    const { sql: whereSql, params: whereParams } = renderWhere(this.s.filters);
    // SQLite requires a WHERE for safety. If no filters were applied, mimic
    // the pattern from api.ts which uses `.not('id', 'is', null)` and just
    // pass `1=1`.
    const sql = `DELETE FROM ${quoteIdent(this.s.table)}${whereSql || ' WHERE 1=1'}`;
    const { rowsAffected } = await executeQuery(sql, whereParams as never);

    return {
      data: [] as never,
      error: null,
      count: rowsAffected,
      status: 200,
      statusText: 'OK',
    };
  }

  // -------------------- response shaping ------------------------------

  private finalizeRead(rows: Row[], count: number | null): AdapterResponse<unknown> {
    if (this.s.expectSingle) {
      if (rows.length === 1) {
        return { data: rows[0], error: null, count, status: 200, statusText: 'OK' };
      }
      if (rows.length === 0) {
        if (this.s.allowZero) {
          return { data: null, error: null, count, status: 200, statusText: 'OK' };
        }
        return {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          count,
          status: 406,
          statusText: 'Not Acceptable',
        };
      }
      // More than one row but single requested
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        count,
        status: 406,
        statusText: 'Not Acceptable',
      };
    }
    return { data: rows, error: null, count, status: 200, statusText: 'OK' };
  }

  private finalizeWrite(rows: Row[]): AdapterResponse<unknown> {
    if (this.s.expectSingle) {
      const row = rows[0] ?? null;
      if (!row && !this.s.allowZero) {
        return {
          data: null,
          error: { message: 'No row returned after mutation' },
          count: null,
          status: 406,
          statusText: 'Not Acceptable',
        };
      }
      return { data: row, error: null, count: null, status: 201, statusText: 'Created' };
    }
    return {
      data: this.s.returnRows ? rows : null,
      error: null,
      count: null,
      status: 201,
      statusText: 'Created',
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderParentColumns(cols: string[]): string {
  if (cols.length === 1 && cols[0] === '*') return '*';
  return cols.map((c) => quoteIdent(c)).join(', ');
}

function collectColumns(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  return Array.from(set);
}

/**
 * Normalise values before binding to SQLite. JS `undefined` → null,
 * Date → ISO string, objects/arrays → JSON string. Everything else
 * passes straight through.
 */
function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

// Type re-exports for callers
export type { EmbeddedSpec };
