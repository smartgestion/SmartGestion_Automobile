/**
 * Foreign-key map + embedded-relation parser.
 *
 * Supabase's PostgREST lets the client request related tables in a single
 * SELECT call, e.g.:
 *
 *   .select('*, client:clients(*)')
 *   .select('*, lignes:facture_lignes(*), client:clients(*)')
 *   .select('*, clients(nom, nom_societe)')
 *
 * SQLite has no equivalent. The adapter handles this in two steps:
 *
 *   1. Parse the select string into (parent columns) + (relation specs).
 *   2. After the parent SELECT runs, issue one extra SELECT per relation
 *      and stitch the results onto each parent row under the relation's
 *      alias (or the relation's table name when no alias is given).
 *
 * The known relations are declared explicitly because we don't introspect
 * SQLite's `PRAGMA foreign_key_list` at runtime — it's faster and matches
 * the schema we control (see `src-tauri/src/db/schema.rs`).
 */

import { Filter, quoteIdent } from './sql';

// ---------------------------------------------------------------------------
// Relation definition
// ---------------------------------------------------------------------------

export interface RelationDef {
  /** Whether the parent table has the FK column (belongsTo) or the child does (hasMany). */
  kind: 'belongsTo' | 'hasMany';
  /** Column on the side that holds the foreign-key value. */
  fkColumn: string;
  /** Primary-key column on the OTHER side. Defaults to `id`. */
  pkColumn?: string;
}

type RelationMap = Record<string, Record<string, RelationDef>>;

/**
 * `RELATIONS[parentTable][childTableOrAlias]` describes how to join.
 *
 * Keys on the inner record may be either the actual child table name or a
 * common alias used in the code base. The parser strips aliases first, so
 * lookups happen by table name.
 */
export const RELATIONS: RelationMap = {
  // -------------------- sales-side -------------------------------------
  factures: {
    clients:        { kind: 'belongsTo', fkColumn: 'client_id' },
    devis:          { kind: 'belongsTo', fkColumn: 'devis_id' },
    facture_lignes: { kind: 'hasMany',   fkColumn: 'facture_id' },
    avoirs:         { kind: 'hasMany',   fkColumn: 'facture_id' },
  },
  facture_lignes: {
    factures: { kind: 'belongsTo', fkColumn: 'facture_id' },
    produits: { kind: 'belongsTo', fkColumn: 'produit_id' },
  },
  devis: {
    clients:      { kind: 'belongsTo', fkColumn: 'client_id' },
    devis_lignes: { kind: 'hasMany',   fkColumn: 'devis_id' },
    factures:     { kind: 'hasMany',   fkColumn: 'devis_id' },
  },
  devis_lignes: {
    devis:    { kind: 'belongsTo', fkColumn: 'devis_id' },
    produits: { kind: 'belongsTo', fkColumn: 'produit_id' },
  },
  avoirs: {
    factures:     { kind: 'belongsTo', fkColumn: 'facture_id' },
    clients:      { kind: 'belongsTo', fkColumn: 'client_id' },
    avoir_lignes: { kind: 'hasMany',   fkColumn: 'avoir_id' },
  },
  avoir_lignes: {
    avoirs:   { kind: 'belongsTo', fkColumn: 'avoir_id' },
    produits: { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- purchasing-side --------------------------------
  bons_commande: {
    fournisseurs:        { kind: 'belongsTo', fkColumn: 'fournisseur_id' },
    bon_commande_lignes: { kind: 'hasMany',   fkColumn: 'bon_commande_id' },
    bons_livraison:      { kind: 'hasMany',   fkColumn: 'bon_commande_id' },
    avoirs_fournisseur:  { kind: 'hasMany',   fkColumn: 'bon_commande_id' },
  },
  bon_commande_lignes: {
    bons_commande: { kind: 'belongsTo', fkColumn: 'bon_commande_id' },
    produits:      { kind: 'belongsTo', fkColumn: 'produit_id' },
  },
  bons_livraison: {
    fournisseurs:         { kind: 'belongsTo', fkColumn: 'fournisseur_id' },
    bons_commande:        { kind: 'belongsTo', fkColumn: 'bon_commande_id' },
    bon_livraison_lignes: { kind: 'hasMany',   fkColumn: 'bon_livraison_id' },
  },
  bon_livraison_lignes: {
    bons_livraison: { kind: 'belongsTo', fkColumn: 'bon_livraison_id' },
    produits:       { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- supplier credit notes (avoir fournisseur) ------
  avoirs_fournisseur: {
    fournisseurs:             { kind: 'belongsTo', fkColumn: 'fournisseur_id' },
    bons_commande:            { kind: 'belongsTo', fkColumn: 'bon_commande_id' },
    avoir_fournisseur_lignes: { kind: 'hasMany',   fkColumn: 'avoir_fournisseur_id' },
  },
  avoir_fournisseur_lignes: {
    avoirs_fournisseur: { kind: 'belongsTo', fkColumn: 'avoir_fournisseur_id' },
    produits:           { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- sales-side delivery notes (client) -------------
  // Mirror of bons_livraison but tied to a client; never touches stock.
  bons_livraison_client: {
    clients:                     { kind: 'belongsTo', fkColumn: 'client_id' },
    factures:                    { kind: 'belongsTo', fkColumn: 'facture_id' },
    bon_livraison_client_lignes: { kind: 'hasMany',   fkColumn: 'bon_livraison_client_id' },
  },
  bon_livraison_client_lignes: {
    bons_livraison_client: { kind: 'belongsTo', fkColumn: 'bon_livraison_client_id' },
    produits:              { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- expenses ---------------------------------------
  depenses: {
    fournisseurs: { kind: 'belongsTo', fkColumn: 'fournisseur_id' },
  },

  // -------------------- walk-in sales ----------------------------------
  ventes_passagers: {
    ventes_passagers_lignes: { kind: 'hasMany', fkColumn: 'vente_passager_id' },
  },
  ventes_passagers_lignes: {
    ventes_passagers: { kind: 'belongsTo', fkColumn: 'vente_passager_id' },
    produits:         { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- stock journal ----------------------------------
  mouvements_stock: {
    produits: { kind: 'belongsTo', fkColumn: 'produit_id' },
  },

  // -------------------- reverse lookups from the master tables --------
  clients: {
    factures:              { kind: 'hasMany', fkColumn: 'client_id' },
    devis:                 { kind: 'hasMany', fkColumn: 'client_id' },
    avoirs:                { kind: 'hasMany', fkColumn: 'client_id' },
    bons_livraison_client: { kind: 'hasMany', fkColumn: 'client_id' },
  },
  fournisseurs: {
    bons_commande:      { kind: 'hasMany', fkColumn: 'fournisseur_id' },
    bons_livraison:     { kind: 'hasMany', fkColumn: 'fournisseur_id' },
    depenses:           { kind: 'hasMany', fkColumn: 'fournisseur_id' },
    avoirs_fournisseur: { kind: 'hasMany', fkColumn: 'fournisseur_id' },
  },
  produits: {
    facture_lignes:          { kind: 'hasMany', fkColumn: 'produit_id' },
    devis_lignes:            { kind: 'hasMany', fkColumn: 'produit_id' },
    avoir_lignes:            { kind: 'hasMany', fkColumn: 'produit_id' },
    avoir_fournisseur_lignes:{ kind: 'hasMany', fkColumn: 'produit_id' },
    bon_commande_lignes:     { kind: 'hasMany', fkColumn: 'produit_id' },
    bon_livraison_lignes:    { kind: 'hasMany', fkColumn: 'produit_id' },
    bon_livraison_client_lignes: { kind: 'hasMany', fkColumn: 'produit_id' },
    ventes_passagers_lignes: { kind: 'hasMany', fkColumn: 'produit_id' },
    mouvements_stock:        { kind: 'hasMany', fkColumn: 'produit_id' },
  },
};

// ---------------------------------------------------------------------------
// Select-string parser
// ---------------------------------------------------------------------------

export interface EmbeddedSpec {
  /** Alias used by the caller (`client:clients(*)` → `client`). */
  alias: string;
  /** Actual table name (`clients`). */
  table: string;
  /** Columns requested on the child; `['*']` for all. */
  columns: string[];
}

export interface ParsedSelect {
  /** Columns to select on the parent table. */
  parentColumns: string[];
  /** Embedded relations to fetch and stitch after the parent SELECT. */
  embedded: EmbeddedSpec[];
}

/**
 * Parse a Supabase select-string into parent columns and embedded relations.
 *
 * Supports:
 *   '*'
 *   'col1, col2'
 *   '*, relation(*)'
 *   '*, alias:relation(*)'
 *   '*, relation(a, b, c)'
 *   any combination thereof.
 */
export function parseSelectString(input: string): ParsedSelect {
  const parts = splitTopLevel(input);
  const parentColumns: string[] = [];
  const embedded: EmbeddedSpec[] = [];

  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;

    // relation form: `alias:table(cols)` or `table(cols)`
    const relMatch = part.match(/^(?:([A-Za-z_][A-Za-z0-9_]*)\s*:\s*)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)$/);
    if (relMatch) {
      const [, aliasMaybe, table, colsRaw] = relMatch;
      const cols = colsRaw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      embedded.push({
        alias: aliasMaybe ?? table,
        table,
        columns: cols.length === 0 ? ['*'] : cols,
      });
      continue;
    }

    // plain column
    parentColumns.push(part);
  }

  if (parentColumns.length === 0) parentColumns.push('*');

  return { parentColumns, embedded };
}

/** Split a string by top-level commas (ignore commas inside parentheses). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

// ---------------------------------------------------------------------------
// Stitching: given parent rows + embedded specs, run extra queries and
// attach the child rows under each spec's alias key.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

export interface StitchContext {
  parentTable: string;
  parentRows: Row[];
  embedded: EmbeddedSpec[];
  /** Function the caller provides to fetch rows by SQL (so we don't depend on runtime here). */
  fetchRows: (sql: string, params: unknown[]) => Promise<Row[]>;
}

export async function stitchEmbedded(ctx: StitchContext): Promise<Row[]> {
  if (ctx.embedded.length === 0 || ctx.parentRows.length === 0) {
    return ctx.parentRows;
  }

  for (const spec of ctx.embedded) {
    const def = resolveRelation(ctx.parentTable, spec.table);
    if (!def) {
      // Unknown relation — fail loudly so we notice and update RELATIONS map.
      throw new Error(
        `Unknown embedded relation: ${ctx.parentTable} -> ${spec.table}. ` +
          `Add it to src/lib/db/relations.ts::RELATIONS.`,
      );
    }

    const pkCol = def.pkColumn ?? 'id';

    if (def.kind === 'belongsTo') {
      // Parent row holds the FK; collect distinct FK values and fetch parents.
      const fkValues = uniq(
        ctx.parentRows
          .map((r) => r[def.fkColumn])
          .filter((v) => v !== null && v !== undefined),
      );
      if (fkValues.length === 0) {
        for (const r of ctx.parentRows) r[spec.alias] = null;
        continue;
      }
      const cols = renderEmbeddedColumns(spec.columns);
      const sql = `SELECT ${cols} FROM ${quoteIdent(spec.table)} WHERE ${quoteIdent(
        pkCol,
      )} IN (${fkValues.map(() => '?').join(', ')})`;
      const childRows = await ctx.fetchRows(sql, fkValues);
      const byPk = new Map<unknown, Row>();
      for (const cr of childRows) byPk.set(cr[pkCol], cr);

      for (const pr of ctx.parentRows) {
        const fk = pr[def.fkColumn];
        pr[spec.alias] = fk === null || fk === undefined ? null : byPk.get(fk) ?? null;
      }
    } else {
      // hasMany: child rows hold the FK pointing back at parent.id
      const parentIds = uniq(
        ctx.parentRows
          .map((r) => r[pkCol])
          .filter((v) => v !== null && v !== undefined),
      );
      if (parentIds.length === 0) {
        for (const r of ctx.parentRows) r[spec.alias] = [];
        continue;
      }
      const cols = renderEmbeddedColumns(spec.columns);
      const sql = `SELECT ${cols} FROM ${quoteIdent(spec.table)} WHERE ${quoteIdent(
        def.fkColumn,
      )} IN (${parentIds.map(() => '?').join(', ')})`;
      const childRows = await ctx.fetchRows(sql, parentIds);
      const byParent = new Map<unknown, Row[]>();
      for (const cr of childRows) {
        const key = cr[def.fkColumn];
        const list = byParent.get(key) ?? [];
        list.push(cr);
        byParent.set(key, list);
      }
      for (const pr of ctx.parentRows) {
        pr[spec.alias] = byParent.get(pr[pkCol]) ?? [];
      }
    }
  }

  return ctx.parentRows;
}

function renderEmbeddedColumns(cols: string[]): string {
  if (cols.length === 1 && cols[0] === '*') return '*';
  return cols.map((c) => quoteIdent(c)).join(', ');
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function resolveRelation(
  parent: string,
  child: string,
): RelationDef | null {
  return RELATIONS[parent]?.[child] ?? null;
}

// Re-export so the builder can use it directly.
export type { Filter };
