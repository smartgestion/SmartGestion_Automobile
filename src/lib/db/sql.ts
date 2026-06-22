/**
 * SQL building primitives.
 *
 * Identifier quoting: SQLite accepts double quotes for identifiers.
 * We *only* quote identifiers (table / column names) — values are always
 * passed as positional `?` parameters to avoid any chance of SQL injection.
 */

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  // Allow already-qualified identifiers like `t.col`
  if (name.includes('.')) {
    return name
      .split('.')
      .map((part) => quoteIdent(part))
      .join('.');
  }
  if (!IDENT_RE.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

export function quoteIdents(names: string[]): string {
  return names.map(quoteIdent).join(', ');
}

/** Build a `?, ?, ?` placeholder list of length `n`. */
export function placeholders(n: number): string {
  return new Array(n).fill('?').join(', ');
}

// ---------------------------------------------------------------------------
// Where-clause building
// ---------------------------------------------------------------------------

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is'
  | 'not.eq'
  | 'not.neq'
  | 'not.is'
  | 'not.in'
  | 'not.like'
  | 'not.ilike'
  | 'contains'
  | 'match';

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
  /** Pre-built raw SQL fragment (already containing its own parameters). */
  raw?: { sql: string; params: unknown[] };
}

/**
 * Render a single filter to `{sql, params}`.
 *
 * `column` is quoted as an identifier; `value` is always passed as a
 * positional `?` parameter (except for `IN` where it expands to a list of
 * placeholders).
 */
export function renderFilter(f: Filter): { sql: string; params: unknown[] } {
  if (f.raw) return f.raw;

  const col = quoteIdent(f.column);
  const v = f.value;

  switch (f.op) {
    case 'eq':
      // `eq` with null is treated as IS NULL (Supabase mirrors this).
      if (v === null) return { sql: `${col} IS NULL`, params: [] };
      return { sql: `${col} = ?`, params: [v] };
    case 'neq':
      if (v === null) return { sql: `${col} IS NOT NULL`, params: [] };
      return { sql: `${col} <> ?`, params: [v] };
    case 'gt':
      return { sql: `${col} > ?`, params: [v] };
    case 'gte':
      return { sql: `${col} >= ?`, params: [v] };
    case 'lt':
      return { sql: `${col} < ?`, params: [v] };
    case 'lte':
      return { sql: `${col} <= ?`, params: [v] };
    case 'like':
      return { sql: `${col} LIKE ?`, params: [v] };
    case 'ilike':
      // SQLite LIKE is already case-insensitive for ASCII; for Unicode we
      // lower-case both sides explicitly.
      return { sql: `LOWER(${col}) LIKE LOWER(?)`, params: [v] };
    case 'in': {
      const arr = Array.isArray(v) ? v : [v];
      if (arr.length === 0) {
        // `column IN ()` is invalid SQL; mimic Supabase (returns no rows).
        return { sql: '0 = 1', params: [] };
      }
      return { sql: `${col} IN (${placeholders(arr.length)})`, params: arr };
    }
    case 'is':
      // .is(col, null) / .is(col, true|false)
      if (v === null) return { sql: `${col} IS NULL`, params: [] };
      if (v === true) return { sql: `${col} IS 1`, params: [] };
      if (v === false) return { sql: `${col} IS 0`, params: [] };
      return { sql: `${col} IS ?`, params: [v] };
    case 'not.eq':
      if (v === null) return { sql: `${col} IS NOT NULL`, params: [] };
      return { sql: `${col} <> ?`, params: [v] };
    case 'not.neq':
      if (v === null) return { sql: `${col} IS NULL`, params: [] };
      return { sql: `${col} = ?`, params: [v] };
    case 'not.is':
      if (v === null) return { sql: `${col} IS NOT NULL`, params: [] };
      if (v === true) return { sql: `${col} IS NOT 1`, params: [] };
      if (v === false) return { sql: `${col} IS NOT 0`, params: [] };
      return { sql: `${col} IS NOT ?`, params: [v] };
    case 'not.in': {
      const arr = Array.isArray(v) ? v : [v];
      if (arr.length === 0) return { sql: '1 = 1', params: [] };
      return { sql: `${col} NOT IN (${placeholders(arr.length)})`, params: arr };
    }
    case 'not.like':
      return { sql: `${col} NOT LIKE ?`, params: [v] };
    case 'not.ilike':
      return { sql: `LOWER(${col}) NOT LIKE LOWER(?)`, params: [v] };
    case 'contains':
      // For text columns: substring; mirrors a common usage of .contains().
      return { sql: `${col} LIKE ?`, params: [`%${String(v)}%`] };
    case 'match':
      // .match({k:v, k2:v2}) — handled at builder level by emitting multiple eq filters.
      throw new Error(
        '"match" filter should be expanded by the builder, not rendered directly',
      );
  }
}

export function renderWhere(filters: Filter[]): { sql: string; params: unknown[] } {
  if (filters.length === 0) return { sql: '', params: [] };
  const parts = filters.map(renderFilter);
  return {
    sql: ' WHERE ' + parts.map((p) => p.sql).join(' AND '),
    params: parts.flatMap((p) => p.params),
  };
}

// ---------------------------------------------------------------------------
// PostgREST-style `.or()` parsing
//
// Example: 'designation.eq.foo,nom.ilike.%bar%'
// Renders to: (designation = ? OR LOWER(nom) LIKE LOWER(?))
// ---------------------------------------------------------------------------

export function parseOrExpr(expr: string): { sql: string; params: unknown[] } {
  // Splits at top-level commas only (avoids breaking on commas inside values).
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);

  const fragments: { sql: string; params: unknown[] }[] = parts.map((part) => {
    // Each part: column.op.value
    const m = part.match(/^([A-Za-z0-9_]+)\.([a-z]+)\.(.*)$/);
    if (!m) throw new Error(`Unrecognized .or() expression part: "${part}"`);
    const [, column, op, rawValue] = m;
    const value = decodeOrValue(rawValue);
    return renderFilter({ column, op: op as FilterOp, value });
  });

  return {
    sql: '(' + fragments.map((f) => f.sql).join(' OR ') + ')',
    params: fragments.flatMap((f) => f.params),
  };
}

function decodeOrValue(raw: string): unknown {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // numeric literal
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

// ---------------------------------------------------------------------------
// ORDER / LIMIT / OFFSET
// ---------------------------------------------------------------------------

export interface OrderClause {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

export function renderOrder(orders: OrderClause[]): string {
  if (orders.length === 0) return '';
  const parts = orders.map((o) => {
    const dir = o.ascending ? 'ASC' : 'DESC';
    const nulls =
      o.nullsFirst === undefined
        ? ''
        : ` NULLS ${o.nullsFirst ? 'FIRST' : 'LAST'}`;
    return `${quoteIdent(o.column)} ${dir}${nulls}`;
  });
  return ' ORDER BY ' + parts.join(', ');
}

export function renderLimitOffset(limit?: number, offset?: number): string {
  let sql = '';
  if (typeof limit === 'number') sql += ` LIMIT ${Math.max(0, Math.floor(limit))}`;
  if (typeof offset === 'number') {
    if (typeof limit !== 'number') sql += ` LIMIT -1`; // SQLite needs LIMIT before OFFSET
    sql += ` OFFSET ${Math.max(0, Math.floor(offset))}`;
  }
  return sql;
}
