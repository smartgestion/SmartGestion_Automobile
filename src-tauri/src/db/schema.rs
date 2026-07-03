//! SQLite schema translated from the Supabase Postgres schema.
//!
//! Translation rules applied:
//! - `bigint NOT NULL DEFAULT nextval(...)`  -> `INTEGER PRIMARY KEY AUTOINCREMENT`
//! - `numeric`                                -> `REAL`
//! - `uuid`                                   -> `TEXT` (uuid string)
//! - `timestamp with time zone DEFAULT now()` -> `TEXT DEFAULT CURRENT_TIMESTAMP`
//! - `date DEFAULT CURRENT_DATE`              -> `TEXT DEFAULT CURRENT_DATE`
//! - `boolean`                                -> `INTEGER` (0/1)
//! - FKs to `auth.users(id)` are dropped (no local auth schema); `user_id`
//!   columns are kept as TEXT so the Supabase schema parity is preserved for
//!   future cloud-sync.
//! - All other primary keys, foreign keys, defaults and CHECK constraints
//!   are preserved exactly as in the source schema.

/// Statements executed in order on a fresh database.
///
/// Order matters: parent tables before children that reference them.
pub const MIGRATIONS: &[&str] = &[
    // -----------------------------------------------------------------
    // Schema-version bookkeeping
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER PRIMARY KEY,
        applied_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    "#,

    // -----------------------------------------------------------------
    // Independent / parent tables
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS clients (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        nom           TEXT    NOT NULL,
        email         TEXT,
        telephone     TEXT,
        adresse       TEXT,
        ville         TEXT,
        code_postal   TEXT,
        pays          TEXT    DEFAULT 'Maroc',
        ice           TEXT,
        rc            TEXT,
        if_identifiant TEXT,
        patente       TEXT,
        notes         TEXT,
        created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        code          TEXT,
        type          TEXT    DEFAULT 'entreprise',
        user_id       TEXT,
        nom_societe   TEXT
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS fournisseurs (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nom          TEXT    NOT NULL,
        email        TEXT,
        telephone    TEXT,
        adresse      TEXT,
        ville        TEXT,
        ice          TEXT,
        notes        TEXT,
        created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
        contact      TEXT,
        code_postale TEXT,
        type         TEXT    DEFAULT 'entreprise',
        user_id      TEXT,
        code         TEXT,
        nom_societe  TEXT
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS produits (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        reference       TEXT,
        designation     TEXT    NOT NULL,
        nom             TEXT,
        description     TEXT,
        categorie       TEXT,
        marque          TEXT,
        barcode         TEXT,
        image_url       TEXT,
        prix_achat_ht   REAL    DEFAULT 0,
        prix_vente_ht   REAL    DEFAULT 0,
        tva             REAL    DEFAULT 20,
        prix_achat_ttc  REAL    DEFAULT 0,
        prix_vente_ttc  REAL    DEFAULT 0,
        stock_actuel    REAL    DEFAULT 0,
        stock_min       REAL    DEFAULT 5,
        unite           TEXT    DEFAULT 'unité',
        is_active       INTEGER DEFAULT 1,
        created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        taux_tva        REAL    DEFAULT 20,
        user_id         TEXT
    );
    "#,

    // -----------------------------------------------------------------
    // Sales-side documents
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS devis (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        numero              TEXT    NOT NULL,
        client_id           INTEGER,
        date_emission       TEXT    DEFAULT CURRENT_DATE,
        date_validite       TEXT,
        statut              TEXT    DEFAULT 'brouillon',
        montant_ht          REAL    DEFAULT 0,
        montant_tva         REAL    DEFAULT 0,
        montant_ttc         REAL    DEFAULT 0,
        notes               TEXT,
        conditions_paiement TEXT,
        created_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        mode_paiement       TEXT,
        date_echeance       TEXT,
        voiture             TEXT,
        matricule           TEXT,
        user_id             TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS devis_lignes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        devis_id         INTEGER,
        produit_id       INTEGER,
        reference        TEXT,
        designation      TEXT    NOT NULL,
        quantite         REAL    NOT NULL,
        prix_unitaire_ht REAL    NOT NULL,
        tva              REAL    DEFAULT 20,
        montant_ht       REAL,
        montant_ttc      REAL,
        ordre            INTEGER DEFAULT 0,
        montant_tva      REAL    DEFAULT 0,
        FOREIGN KEY (devis_id)   REFERENCES devis(id),
        FOREIGN KEY (produit_id) REFERENCES produits(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS factures (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        numero              TEXT    NOT NULL,
        client_id           INTEGER,
        devis_id            INTEGER,
        date_emission       TEXT    DEFAULT CURRENT_DATE,
        date_echeance       TEXT,
        statut              TEXT    DEFAULT 'brouillon',
        mode_paiement       TEXT,
        voiture             TEXT,
        matricule           TEXT,
        montant_ht          REAL    DEFAULT 0,
        montant_tva         REAL    DEFAULT 0,
        montant_ttc         REAL    DEFAULT 0,
        reste_a_payer       REAL    DEFAULT 0,
        notes               TEXT,
        conditions_paiement TEXT,
        created_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        cogs                REAL    DEFAULT 0,
        stock_updated       INTEGER DEFAULT 0,
        user_id             TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (devis_id)  REFERENCES devis(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS facture_lignes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        facture_id       INTEGER,
        produit_id       INTEGER,
        reference        TEXT,
        designation      TEXT    NOT NULL,
        quantite         REAL    NOT NULL,
        prix_unitaire_ht REAL    NOT NULL,
        tva              REAL    DEFAULT 20,
        montant_ht       REAL,
        montant_ttc      REAL,
        ordre            INTEGER DEFAULT 0,
        FOREIGN KEY (facture_id) REFERENCES factures(id),
        FOREIGN KEY (produit_id) REFERENCES produits(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS avoirs (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        numero        TEXT    NOT NULL,
        facture_id    INTEGER,
        client_id     INTEGER,
        date_emission TEXT    DEFAULT CURRENT_DATE,
        motif         TEXT,
        montant_ht    REAL    DEFAULT 0,
        montant_tva   REAL    DEFAULT 0,
        montant_ttc   REAL    DEFAULT 0,
        statut        TEXT    DEFAULT 'brouillon',
        notes         TEXT,
        voiture       TEXT,
        matricule     TEXT,
        created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id       TEXT,
        FOREIGN KEY (client_id)  REFERENCES clients(id),
        FOREIGN KEY (facture_id) REFERENCES factures(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS avoir_lignes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        avoir_id         INTEGER,
        produit_id       INTEGER,
        reference        TEXT,
        designation      TEXT    NOT NULL,
        quantite         REAL    NOT NULL,
        prix_unitaire_ht REAL    NOT NULL,
        tva              REAL    DEFAULT 20,
        montant_ht       REAL,
        montant_ttc      REAL,
        ordre            INTEGER DEFAULT 0,
        FOREIGN KEY (avoir_id)   REFERENCES avoirs(id),
        FOREIGN KEY (produit_id) REFERENCES produits(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Purchasing-side documents
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS bons_commande (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        numero                TEXT    NOT NULL,
        fournisseur_id        INTEGER,
        date_commande         TEXT    DEFAULT CURRENT_DATE,
        date_livraison_prevue TEXT,
        statut                TEXT    DEFAULT 'brouillon',
        montant_ht            REAL    DEFAULT 0,
        montant_tva           REAL    DEFAULT 0,
        montant_ttc           REAL    DEFAULT 0,
        notes                 TEXT,
        created_at            TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at            TEXT    DEFAULT CURRENT_TIMESTAMP,
        stock_updated         INTEGER DEFAULT 0,
        user_id               TEXT,
        FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS bon_commande_lignes (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        bon_commande_id  INTEGER,
        produit_id       INTEGER,
        reference        TEXT,
        designation      TEXT    NOT NULL,
        quantite         REAL    NOT NULL,
        prix_unitaire_ht REAL    NOT NULL,
        tva              REAL    DEFAULT 20,
        ordre            INTEGER DEFAULT 0,
        montant_ht       REAL    DEFAULT 0,
        montant_ttc      REAL    DEFAULT 0,
        FOREIGN KEY (bon_commande_id) REFERENCES bons_commande(id),
        FOREIGN KEY (produit_id)      REFERENCES produits(id)
    );
    "#,

    // Supplier credit notes (purchase-side mirror of avoirs).
    r#"
    CREATE TABLE IF NOT EXISTS avoirs_fournisseur (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        numero          TEXT    NOT NULL,
        bon_commande_id INTEGER,
        fournisseur_id  INTEGER,
        date_emission   TEXT    DEFAULT CURRENT_DATE,
        montant_ht      REAL    DEFAULT 0,
        montant_tva     REAL    DEFAULT 0,
        montant_ttc     REAL    DEFAULT 0,
        statut          TEXT    DEFAULT 'émis',
        notes           TEXT,
        created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id         TEXT,
        FOREIGN KEY (fournisseur_id)  REFERENCES fournisseurs(id),
        FOREIGN KEY (bon_commande_id) REFERENCES bons_commande(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS avoir_fournisseur_lignes (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        avoir_fournisseur_id INTEGER,
        produit_id           INTEGER,
        reference            TEXT,
        designation          TEXT    NOT NULL,
        quantite             REAL    NOT NULL,
        prix_unitaire_ht     REAL    NOT NULL,
        tva                  REAL    DEFAULT 20,
        montant_ht           REAL,
        montant_ttc          REAL,
        ordre                INTEGER DEFAULT 0,
        FOREIGN KEY (avoir_fournisseur_id) REFERENCES avoirs_fournisseur(id),
        FOREIGN KEY (produit_id)           REFERENCES produits(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS bons_livraison (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        numero          TEXT    NOT NULL,
        fournisseur_id  INTEGER,
        bon_commande_id INTEGER,
        date_livraison  TEXT    DEFAULT CURRENT_DATE,
        statut          TEXT    DEFAULT 'reçu',
        montant_ht      REAL    DEFAULT 0,
        montant_tva     REAL    DEFAULT 0,
        montant_ttc     REAL    DEFAULT 0,
        stock_updated   INTEGER DEFAULT 0,
        notes           TEXT,
        created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id         TEXT,
        FOREIGN KEY (bon_commande_id) REFERENCES bons_commande(id),
        FOREIGN KEY (fournisseur_id)  REFERENCES fournisseurs(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS bon_livraison_lignes (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        bon_livraison_id  INTEGER,
        produit_id        INTEGER,
        reference         TEXT,
        designation       TEXT    NOT NULL,
        quantite          REAL    NOT NULL,
        prix_unitaire_ht  REAL    NOT NULL,
        tva               REAL    DEFAULT 20,
        ordre             INTEGER DEFAULT 0,
        montant_ht        REAL    DEFAULT 0,
        montant_ttc       REAL    DEFAULT 0,
        FOREIGN KEY (bon_livraison_id) REFERENCES bons_livraison(id),
        FOREIGN KEY (produit_id)       REFERENCES produits(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Sales-side delivery notes (client). Mirrors `bons_livraison` but is
    // tied to a client and NEVER touches stock — purely a printable
    // delivery document for the customer.
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS bons_livraison_client (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        numero          TEXT    NOT NULL,
        client_id       INTEGER,
        facture_id      INTEGER,
        date_livraison  TEXT    DEFAULT CURRENT_DATE,
        statut          TEXT    DEFAULT 'en_attente',
        voiture         TEXT,
        matricule       TEXT,
        montant_ht      REAL    DEFAULT 0,
        montant_tva     REAL    DEFAULT 0,
        montant_ttc     REAL    DEFAULT 0,
        notes           TEXT,
        created_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id         TEXT,
        FOREIGN KEY (client_id)  REFERENCES clients(id),
        FOREIGN KEY (facture_id) REFERENCES factures(id)
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS bon_livraison_client_lignes (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        bon_livraison_client_id  INTEGER,
        produit_id               INTEGER,
        reference                TEXT,
        designation              TEXT    NOT NULL,
        quantite                 REAL    NOT NULL,
        prix_unitaire_ht         REAL    NOT NULL,
        tva                      REAL    DEFAULT 20,
        ordre                    INTEGER DEFAULT 0,
        montant_ht               REAL    DEFAULT 0,
        montant_ttc              REAL    DEFAULT 0,
        FOREIGN KEY (bon_livraison_client_id) REFERENCES bons_livraison_client(id),
        FOREIGN KEY (produit_id)              REFERENCES produits(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Expenses
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS depenses (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        numero              TEXT    UNIQUE,
        fournisseur_id      INTEGER,
        categorie           TEXT,
        description         TEXT,
        date_depense        TEXT    DEFAULT CURRENT_DATE,
        montant_ht          REAL    DEFAULT 0,
        tva                 REAL    DEFAULT 20,
        montant_ttc         REAL    DEFAULT 0,
        mode_paiement       TEXT,
        reference_paiement  TEXT,
        notes               TEXT,
        created_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        montant_tva         REAL    DEFAULT 0,
        reference           TEXT,
        user_id             TEXT,
        FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Walk-in sales (ventes passagers)
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS ventes_passagers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        numero        TEXT    NOT NULL,
        date          TEXT    DEFAULT CURRENT_DATE,
        client_nom    TEXT,
        montant_ht    REAL    DEFAULT 0,
        montant_tva   REAL    DEFAULT 0,
        montant_ttc   REAL    DEFAULT 0,
        mode_paiement TEXT,
        notes         TEXT,
        created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        cogs          REAL    DEFAULT 0,
        user_id       TEXT
    );
    "#,

    r#"
    CREATE TABLE IF NOT EXISTS ventes_passagers_lignes (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        vente_passager_id INTEGER,
        produit_id        INTEGER,
        reference         TEXT,
        designation       TEXT    NOT NULL,
        quantite          REAL    NOT NULL,
        prix_unitaire_ht  REAL    NOT NULL,
        tva               REAL    DEFAULT 20,
        montant_ht        REAL,
        montant_ttc       REAL,
        ordre             INTEGER DEFAULT 0,
        montant_tva       REAL    DEFAULT 0,
        vp_id             INTEGER,
        FOREIGN KEY (produit_id)        REFERENCES produits(id),
        FOREIGN KEY (vente_passager_id) REFERENCES ventes_passagers(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Stock movement journal
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS mouvements_stock (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        produit_id          INTEGER,
        type                TEXT    NOT NULL,
        quantite            REAL    DEFAULT 0,
        notes               TEXT,
        reference_document  TEXT,
        entite_nom          TEXT,
        prix_unitaire       REAL    DEFAULT 0,
        date_mouvement      TEXT    DEFAULT CURRENT_TIMESTAMP,
        created_at          TEXT    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produit_id) REFERENCES produits(id)
    );
    "#,

    // -----------------------------------------------------------------
    // Activity log
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS logs_activites (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        action       TEXT    NOT NULL,
        details      TEXT,
        entite_type  TEXT,
        entite_id    TEXT,
        utilisateur  TEXT,
        date_action  TEXT    DEFAULT CURRENT_TIMESTAMP,
        created_at   TEXT    DEFAULT CURRENT_TIMESTAMP
    );
    "#,

    // -----------------------------------------------------------------
    // Notifications
    //
    // Note: in Postgres `id` was uuid with `gen_random_uuid()`; in SQLite
    // we use a TEXT PK and rely on the caller (or a default expression)
    // to supply a uuid string.
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS notifications (
        id          TEXT    PRIMARY KEY,
        user_id     TEXT    NOT NULL,
        title       TEXT    NOT NULL,
        message     TEXT    NOT NULL,
        type        TEXT    NOT NULL DEFAULT 'info'
                             CHECK (type IN ('success','error','warning','info')),
        is_read     INTEGER NOT NULL DEFAULT 0,
        link        TEXT,
        created_at  TEXT    DEFAULT CURRENT_TIMESTAMP
    );
    "#,

    // -----------------------------------------------------------------
    // Application settings (singleton-ish, keyed by user_id which is UNIQUE)
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS parametres (
        id                          INTEGER PRIMARY KEY AUTOINCREMENT,
        nom_entreprise              TEXT,
        adresse                     TEXT,
        telephone                   TEXT,
        email                       TEXT,
        ice                         TEXT,
        rc                          TEXT,
        if_identifiant              TEXT,
        patente                     TEXT,
        logo_url                    TEXT,
        devise                      TEXT    DEFAULT 'DH',
        conditions_paiement_defaut  TEXT,
        pied_page_defaut            TEXT,
        created_at                  TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at                  TEXT    DEFAULT CURRENT_TIMESTAMP,
        activer_droit_timbre        INTEGER DEFAULT 1,
        couleur_principale          TEXT    DEFAULT '#267E54',
        banque                      TEXT    DEFAULT '',
        rib                         TEXT    DEFAULT '',
        swift                       TEXT    DEFAULT '',
        if_number                   TEXT    DEFAULT '',
        tp_patente                  TEXT    DEFAULT '',
        cnss                        TEXT    DEFAULT '',
        capital_social              TEXT    DEFAULT '',
        site_web                    TEXT    DEFAULT '',
        code_postale                TEXT    DEFAULT '',
        nom_societe                 TEXT,
        nom                         TEXT    DEFAULT '',
        ville                       TEXT    DEFAULT '',
        forme_juridique             TEXT    DEFAULT '',
        user_id                     TEXT    UNIQUE,
        activer_filigrane           INTEGER DEFAULT 1,
        texte_filigrane             TEXT    DEFAULT 'SmartGestion',
        watermark_text              TEXT    DEFAULT 'SmartGestion'
    );
    "#,

    // -----------------------------------------------------------------
    // Tasks
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT    NOT NULL,
        description TEXT,
        completed   INTEGER DEFAULT 0,
        priority    TEXT    DEFAULT 'medium',
        due_date    TEXT,
        created_at  TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT    DEFAULT CURRENT_TIMESTAMP
    );
    "#,

    // -----------------------------------------------------------------
    // Local users (offline authentication)
    //
    // - `id`            : client-side generated UUID (v4) as TEXT.
    // - `email`         : stored lowercased & trimmed; UNIQUE.
    // - `password_hash` : bcrypt-encoded string (~60 chars) containing
    //                     the algorithm marker, cost factor and salt.
    // - `role`          : free-form role label (e.g. 'admin', 'user').
    //
    // The `user_id` TEXT columns on every business table (clients,
    // factures, ...) can now point at `users.id` for multi-user setups.
    // We do not add a hard FK so that pre-existing rows from cloud sync
    // (where user_id was a Supabase auth uuid) continue to validate.
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS users (
        id            TEXT    PRIMARY KEY,
        email         TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        role          TEXT    NOT NULL,
        created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    "#,

    // -----------------------------------------------------------------
    // Portefeuille — document management (folders, uploaded files, papers)
    // -----------------------------------------------------------------
    r#"
    CREATE TABLE IF NOT EXISTS portefeuille_folders (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL,
        parent_id    INTEGER REFERENCES portefeuille_folders(id) ON DELETE CASCADE,
        is_favorite  INTEGER DEFAULT 0,
        is_deleted   INTEGER DEFAULT 0,
        created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id      TEXT
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS portefeuille_items (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id     INTEGER REFERENCES portefeuille_folders(id) ON DELETE CASCADE,
        kind          TEXT    NOT NULL DEFAULT 'file',   -- 'file' | 'paper'
        name          TEXT    NOT NULL,
        mime_type     TEXT,                              -- for uploaded files
        file_ext      TEXT,                              -- e.g. pdf, png, docx
        size_bytes    INTEGER DEFAULT 0,
        content       TEXT,                              -- base64 data-URL (file) OR HTML (paper)
        tags          TEXT,                              -- comma-separated tags
        is_favorite   INTEGER DEFAULT 0,
        is_deleted    INTEGER DEFAULT 0,
        last_opened_at TEXT,
        created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
        user_id       TEXT
    );
    "#,

    // -----------------------------------------------------------------
    // Helpful indexes on hot foreign-key paths
    // -----------------------------------------------------------------
    "CREATE INDEX IF NOT EXISTS idx_users_email                 ON users(email);",
    "CREATE INDEX IF NOT EXISTS idx_pf_folders_parent           ON portefeuille_folders(parent_id);",
    "CREATE INDEX IF NOT EXISTS idx_pf_folders_user             ON portefeuille_folders(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_pf_items_folder             ON portefeuille_items(folder_id);",
    "CREATE INDEX IF NOT EXISTS idx_pf_items_user               ON portefeuille_items(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_pf_items_kind               ON portefeuille_items(kind);",
    "CREATE INDEX IF NOT EXISTS idx_factures_client_id          ON factures(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_factures_devis_id           ON factures(devis_id);",
    "CREATE INDEX IF NOT EXISTS idx_facture_lignes_facture_id   ON facture_lignes(facture_id);",
    "CREATE INDEX IF NOT EXISTS idx_facture_lignes_produit_id   ON facture_lignes(produit_id);",
    "CREATE INDEX IF NOT EXISTS idx_devis_client_id             ON devis(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis_id       ON devis_lignes(devis_id);",
    "CREATE INDEX IF NOT EXISTS idx_avoirs_client_id            ON avoirs(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_avoirs_facture_id           ON avoirs(facture_id);",
    "CREATE INDEX IF NOT EXISTS idx_avoir_lignes_avoir_id       ON avoir_lignes(avoir_id);",
    "CREATE INDEX IF NOT EXISTS idx_bons_commande_fournisseur   ON bons_commande(fournisseur_id);",
    "CREATE INDEX IF NOT EXISTS idx_bc_lignes_bc_id             ON bon_commande_lignes(bon_commande_id);",
    "CREATE INDEX IF NOT EXISTS idx_bons_livraison_fournisseur  ON bons_livraison(fournisseur_id);",
    "CREATE INDEX IF NOT EXISTS idx_bons_livraison_bc_id        ON bons_livraison(bon_commande_id);",
    "CREATE INDEX IF NOT EXISTS idx_bl_lignes_bl_id             ON bon_livraison_lignes(bon_livraison_id);",
    "CREATE INDEX IF NOT EXISTS idx_blc_client_id               ON bons_livraison_client(client_id);",
    "CREATE INDEX IF NOT EXISTS idx_blc_facture_id              ON bons_livraison_client(facture_id);",
    "CREATE INDEX IF NOT EXISTS idx_blc_lignes_blc_id           ON bon_livraison_client_lignes(bon_livraison_client_id);",
    "CREATE INDEX IF NOT EXISTS idx_depenses_fournisseur        ON depenses(fournisseur_id);",
    "CREATE INDEX IF NOT EXISTS idx_vp_lignes_vp_id             ON ventes_passagers_lignes(vente_passager_id);",
    "CREATE INDEX IF NOT EXISTS idx_mouvements_stock_produit    ON mouvements_stock(produit_id);",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id       ON notifications(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_produits_reference          ON produits(reference);",
    "CREATE INDEX IF NOT EXISTS idx_produits_barcode            ON produits(barcode);",
];

/// Current schema version (bump when adding migrations).
///
///   v1 — initial Supabase-parity schema (Task 2).
///   v2 — adds the `users` table for offline authentication (Task 4A).
///   v3 — adds the Portefeuille document management tables
///        (`portefeuille_folders`, `portefeuille_items`).
pub const SCHEMA_VERSION: i64 = 3;
