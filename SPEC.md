# ParaGestion - Parapharmacy Management ERP

## Concept & Vision

ParaGestion is a comprehensive, medical-themed French ERP-lite application designed specifically for parapharmacies. It delivers a clean, professional interface inspired by healthcare aesthetics with teal/blue tones that evoke trust and professionalism. The app streamlines all business operations from invoicing to inventory management with an intuitive, French-localized interface that feels both modern and reliable.

## Design Language

### Aesthetic Direction
Medical/pharmaceutical inspired design with a clean, clinical feel. The interface uses soft gradients, subtle shadows, and rounded corners to create a trustworthy, professional atmosphere suitable for healthcare-related businesses.

### Color Palette
```css
/* Primary - Medical Teal */
--primary: oklch(0.55 0.12 200);

/* Secondary - Soft Gray */
--secondary: oklch(0.94 0.01 200);

/* Accent Colors */
--chart-1: oklch(0.55 0.12 200);   /* Teal - Revenue */
--chart-2: oklch(0.7 0.1 150);     /* Green - Growth */
--chart-3: oklch(0.8 0.1 60);       /* Yellow - Warnings */
--chart-4: oklch(0.6 0.15 25);      /* Red - Destructive */
--chart-5: oklch(0.4 0.1 220);      /* Blue - Info */

/* Status Colors */
--success: oklch(0.7 0.15 145);     /* Paid/Active */
--warning: oklch(0.75 0.12 85);    /* Pending */
--destructive: oklch(0.6 0.15 25);  /* Cancelled/Error */
```

### Typography
- **Headings**: Inter Variable, sans-serif, weight 600-800
- **Body**: Inter Variable, sans-serif, weight 400-500
- **Monospace**: For codes, references, and numbers

### Spatial System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Border radius: 8px (small), 12px (medium), 16px (large)
- Card padding: 24px
- Sidebar width: 256px (expanded), 80px (collapsed)

### Motion Philosophy
- **Micro-interactions**: 200ms ease-out for hover states
- **Transitions**: 300ms ease-in-out for layout changes
- **Page transitions**: Fade-in with 400ms duration
- **Loading states**: Subtle pulse animations
- **Hover effects**: Scale and shadow elevation changes

## Layout & Structure

### Overall Architecture
```
┌─────────────────────────────────────────────────────────┐
│  Header (64px) - Logo, Search, User Menu               │
├────────────┬────────────────────────────────────────────┤
│            │                                            │
│  Sidebar   │  Main Content Area                         │
│  (256px)   │  - Page Title + Actions                   │
│            │  - Content Cards                          │
│  Nav       │  - Data Tables                            │
│  Groups:   │  - Forms/Dialogs                          │
│  - General │                                            │
│  - Achat   │                                            │
│  - Vendre  │                                            │
│  - Contact │                                            │
│  - Stock   │                                            │
│  - System  │                                            │
│            │                                            │
├────────────┴────────────────────────────────────────────┤
```

### Responsive Strategy
- **Desktop (1024px+)**: Full sidebar visible
- **Tablet (768-1023px)**: Collapsible sidebar, 2-column layouts
- **Mobile (<768px)**: Overlay sidebar, single column, touch-optimized

## Features & Interactions

### 1. Authentication
- Email/password login via Supabase Auth
- Protected routes redirect to `/login`
- Session persistence with auto-refresh
- Loading states during auth checks

### 2. Dashboard (`/dashboard`)
**KPIs Displayed:**
- Total Revenue (TTC) with trend indicator
- Unpaid Invoices amount
- Total Expenses (TTC)
- Net Profit calculation
- Stock Value (HT)

**Charts:**
- Revenue vs Expenses Area Chart (6 months)
- TVA Summary (Collected, Deductible, Net)

**Data Tables:**
- Recent Invoices (last 5)
- Low Stock Alerts (products below minimum)

### 3. Clients Management (`/clients`)
**CRUD Operations:**
- Create: Dialog form with validation
- Read: Searchable/sortable table
- Update: Inline edit or dialog
- Delete: Confirmation dialog

**Fields:**
- Code (auto-generated: C001)
- Nom (company or individual)
- Email, Telephone, Adresse
- ICE (tax identification)
- Type (entreprise/particulier)

### 4. Fournisseurs Management (`/fournisseurs`)
Same structure as Clients, linked to purchase orders.

### 5. Products/Inventory (`/produits`)
**Fields:**
- Reference (auto-generated: REF-000001)
- Designation, Description
- Category, Brand
- Prix Achat HT, Prix Vente HT
- TVA Rate (default 20%)
- Stock Actuel, Stock Minimum
- Unit of measure

**Features:**
- Low stock highlighting (amber warning)
- Margin calculation display
- Barcode support
- Image URL field

### 6. Invoices (`/factures`)
**Document Structure:**
- Number: FAC/YYYY/00001 (auto-increment)
- Client selection
- Issue date, Due date
- Line items with product lookup
- Auto-calculated HT, TVA, TTC

**Status Flow:**
`brouillon` → `envoyée` → `payée` / `annulée`

**Line Item Calculation:**
```
montant_ht = quantite × prix_unitaire_ht
montant_tva = montant_ht × (tva / 100)
montant_ttc = montant_ht + montant_tva
```

**Features:**
- Product selection auto-fills price/TVA
- PDF generation and download
- Print functionality
- Mark as paid
- Partial payment tracking (reste_a_payer)
- Credit note (avoir) generation on cancellation

### 7. Quotes (`/devis`)
Similar to invoices with validity date instead of due date.

**Status Flow:**
`brouillon` → `envoyé` → `accepté` / `refusé` / `expiré`

**Features:**
- Convert to Invoice functionality
- PDF generation

### 8. Walk-in Sales (`/ventes-passagers`)
Quick POS-style interface for instant sales without client association.

### 9. Credit Notes (`/avoirs`)
- Linked to original invoice
- Partial or full refund amounts
- Auto-adjusts invoice remaining balance

### 10. Purchase Orders (`/bons-commande`)
Orders to suppliers with expected delivery date.

### 11. Delivery Notes (`/bons-livraison`)
Received deliveries with optional stock update.

### 12. Expenses (`/depenses`)
**Categories:**
- Fournitures, Services, Loyer, Transport, Électricité, Eau, Téléphone, Internet, Assurances, Salaires, Autres

**Features:**
- TVA deductible tracking
- Optional supplier link
- Payment mode and reference

### 13. Settings (`/parametres`)
- Company name, address, contact
- Fiscal IDs: ICE, RC, IF, Patente
- Logo upload
- Default payment terms
- Default footer text
- Currency settings

### 14. Import/Export (`/import-export`)
- Full database backup
- Data export (CSV/JSON)
- Database reset functionality

### 15. SQL Editor (`/sql-editor`)
Direct SQL query execution for advanced users.

## Component Inventory

### Layout Components
| Component | States | Behavior |
|-----------|--------|----------|
| Sidebar | expanded, collapsed, mobile-open | Collapsible with toggle, mobile overlay mode |
| Header | default | Search, user menu, notifications |
| MainLayout | loading, ready | Protected route wrapper |

### UI Components
| Component | Variants | States |
|-----------|----------|--------|
| Button | default, outline, ghost, destructive | hover, active, disabled, loading |
| Input | default, error | focus, filled, disabled |
| Dialog | default | open, closing |
| Table | default | sortable columns, row hover |
| Badge | default, success, warning, destructive | - |
| Card | default | hover shadow |
| Tabs | default | active, disabled |
| Select | default | open, disabled |
| Switch | on, off | disabled |
| Toast | success, error, info | auto-dismiss |

### Form Components
| Component | Validation | Auto-calculation |
|-----------|------------|------------------|
| ClientForm | Zod schema | - |
| FournisseurForm | Zod schema | - |
| ProduitForm | Zod schema | TVA/TTC auto-calc |
| FactureForm | Zod schema | Line totals auto-calc |
| DevisForm | Zod schema | Line totals auto-calc |
| DepenseForm | Zod schema | TVA auto-calc |

### Document Components (PDF)
| Component | Content |
|-----------|---------|
| FactureDocument | Invoice with company header, client info, line items table, totals, legal footer |
| DevisDocument | Quote with validity date |
| BonCommandeDocument | Purchase order |
| BonLivraisonDocument | Delivery note |

## Technical Approach

### Frontend Stack
- **Framework**: React 18 + Vite + TypeScript
- **Routing**: React Router DOM v6
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **PDF**: jsPDF + jsPDF-AutoTable
- **Icons**: Lucide React
- **Notifications**: Sonner (toast)
- **Animations**: Framer Motion + tw-animate-css

### Backend
- **Runtime**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **API**: Express REST endpoints

### Database Schema (17 Tables)
```sql
-- Core Tables
produits (id, reference, designation, categorie, prix_achat_ht, prix_vente_ht, tva, stock_actuel, stock_min, unite)
clients (id, nom, email, telephone, adresse, ice, type)
fournisseurs (id, nom, email, telephone, adresse, ice)
parametres (id, nom_entreprise, adresse, ice, logo_url, devise)

-- Document Tables
factures (id, numero, client_id, date_emission, date_echeance, statut, montant_ht, montant_tva, montant_ttc)
facture_lignes (id, facture_id, produit_id, designation, quantite, prix_unitaire_ht, tva, montant_ht, montant_ttc)
devis (id, numero, client_id, date_validite, statut, montant_ht, montant_tva, montant_ttc)
devis_lignes (same as facture_lignes)
bons_commande (id, numero, fournisseur_id, date_commande, date_livraison_prevue, statut, montant_ht, montant_tva, montant_ttc)
bon_commande_lignes (same structure)
bons_livraison (id, numero, fournisseur_id, date_livraison, statut, montant_ht, montant_tva, montant_ttc)
bon_livraison_lignes (same structure)
ventes_passagers (id, numero, date, montant_ht, montant_tva, montant_ttc)
ventes_passagers_lignes (same structure)
depenses (id, numero, categorie, description, date, montant_ht, montant_tva, montant_ttc, mode_paiement)
avoirs (id, numero, facture_id, client_id, date, motif, montant_ht, montant_tva, montant_ttc, statut)
avoir_lignes (same structure)

-- Supporting Tables
mouvements_stock (id, produit_id, type, quantite, reference_document)
logs_activites (id, action, details, created_at)
```

### API Design
```
GET    /api/dashboard-data
GET    /api/clients
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id
GET    /api/fournisseurs
POST   /api/fournisseurs
PUT    /api/fournisseurs/:id
DELETE /api/fournisseurs/:id
GET    /api/produits
POST   /api/produits
GET    /api/produits/:id
PUT    /api/produits/:id
DELETE /api/produits/:id
GET    /api/factures
POST   /api/factures
GET    /api/factures/:id
PUT    /api/factures/:id
DELETE /api/factures/:id
PUT    /api/factures/:id/statut
GET    /api/devis
POST   /api/devis
GET    /api/devis/:id
PUT    /api/devis/:id
POST   /api/devis/:id/convert
GET    /api/bons-commande
POST   /api/bons-commande
GET    /api/bons-livraison
POST   /api/bons-livraison
GET    /api/avoirs
POST   /api/ventes-passagers
GET    /api/depenses
POST   /api/depenses
PUT    /api/parametres
GET    /api/backup/data
POST   /api/backup/import
POST   /api/sql
```

### TVA (VAT) Calculation
```typescript
// TVA Collectée (Sales VAT)
tvaCollectee = Σ(factures.montant_tva) + Σ(ventes_passagers.montant_tva)
              - Σ(annulled_factures.montant_tva)

// TVA Déductible (Purchase VAT)
tvaDeductible = Σ(bons_commande.montant_tva) + Σ(depenses.montant_tva)

// TVA Net = TVA Collectée - TVA Déductible
tvaNet = tvaCollectee - tvaDeductible
```

### Document Numbering
```
FAC-00001  → Factures
DEV-00001  → Devis
BC-00001   → Bons de Commande
BL-00001   → Bons de Livraison
VP-00001   → Ventes Passagers
DEP-00001  → Dépenses
AV-00001   → Avoirs
```

### Currency Format
- Default: MAD (Moroccan Dirham)
- Format: `new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`
- Example: `1 234,56 DH`

## File Structure
```
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx
│   ├── forms/
│   │   ├── ClientForm.tsx
│   │   ├── FournisseurForm.tsx
│   │   ├── ProduitForm.tsx
│   │   ├── FactureForm.tsx
│   │   ├── DevisForm.tsx
│   │   ├── DepenseForm.tsx
│   │   ├── BonCommandeForm.tsx
│   │   └── BonLivraisonForm.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── DashboardLayout.tsx
│   ├── documents/
│   │   ├── FactureDocument.tsx
│   │   ├── DevisDocument.tsx
│   │   ├── BonCommandeDocument.tsx
│   │   └── BonLivraisonDocument.tsx
│   └── ui/
│       └── [shadcn components]
├── contexts/
│   └── AuthContext.tsx
├── lib/
│   ├── supabase.ts
│   └── utils.ts
├── pages/
│   ├── auth/LoginPage.tsx
│   ├── Dashboard.tsx
│   ├── Workspace.tsx
│   ├── clients/ClientsList.tsx
│   ├── fournisseurs/FournisseursList.tsx
│   ├── produits/ProduitsList.tsx
│   ├── factures/FacturesList.tsx
│   ├── devis/DevisList.tsx
│   ├── ventes-passagers/VentesPassagers.tsx
│   ├── avoirs/AvoirsList.tsx
│   ├── bons-commande/BonsCommandeList.tsx
│   ├── bons-livraison/BonsLivraisonList.tsx
│   ├── depenses/DepensesList.tsx
│   ├── parametres/Parametres.tsx
│   ├── ImportExport.tsx
│   ├── SqlEditor.tsx
│   └── DatabaseManager.tsx
├── routes/
│   └── api.ts
├── App.tsx
├── index.css
└── main.tsx
```
