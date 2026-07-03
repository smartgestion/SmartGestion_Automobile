import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { DirectionProvider } from '@base-ui/react/direction-provider'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { Workspace } from './pages/Workspace'
import { Dashboard } from './pages/Dashboard'
import VentesPassagers from './pages/ventes-passagers/VentesPassagers'
import { ClientsList } from './pages/clients/ClientsList'
import { FournisseursList } from './pages/fournisseurs/FournisseursList'
import { ProduitsList } from './pages/produits/ProduitsList'
import { FacturesList } from './pages/factures/FacturesList'
import { AvoirsList } from './pages/avoirs/AvoirsList'
import { AvoirsFournisseurList } from './pages/avoirs-fournisseur/AvoirsFournisseurList'
import { DevisList } from './pages/devis/DevisList'
import { BonsCommandeList } from './pages/bons-commande/BonsCommandeList'
import { BonsLivraisonList } from './pages/bons-livraison/BonsLivraisonList'
import { BonsLivraisonClientList } from './pages/bons-livraison-client/BonsLivraisonClientList'
import { DepensesList } from './pages/depenses/DepensesList'
import { Parametres } from './pages/parametres/Parametres'
import { DatabaseManager } from './pages/DatabaseManager'
import { SqlEditor } from './pages/SqlEditor'
import { TransactionsList } from './pages/transactions/TransactionsList'
import { Portefeuille } from './pages/portefeuille/Portefeuille'
import { Toaster } from '@/components/ui/sonner'
import i18n from './lib/i18n'

/**
 * Keeps `document.documentElement.dir` and the Base UI `DirectionProvider`
 * in sync with the i18n language. Returns the active direction so the App
 * can pass it into `<DirectionProvider>`, which propagates RTL/LTR to every
 * Base UI primitive (Select, Popover, Menu, Dialog, etc.) without each
 * component needing its own `dir` prop.
 */
function useAppDirection(): 'rtl' | 'ltr' {
  const computeDir = (lng: string | null | undefined): 'rtl' | 'ltr' =>
    lng && lng.startsWith('ar') ? 'rtl' : 'ltr';

  const initial = computeDir(localStorage.getItem('pg_language') || i18n.language);
  const [dir, setDir] = useState<'rtl' | 'ltr'>(initial);

  useEffect(() => {
    // Apply once on mount, then on every language change.
    document.documentElement.dir = dir;

    const handleLanguageChanged = (lng: string) => {
      const next = computeDir(lng);
      document.documentElement.dir = next;
      setDir(next);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
    // We only want this effect to run once on mount; the listener handles updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return dir;
}

export default function App() {
  const dir = useAppDirection();
  return (
    <DirectionProvider direction={dir}>
    <AuthProvider>
      <ThemeProvider>
      <NotificationsProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Workspace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clients" element={<ClientsList />} />
              <Route path="fournisseurs" element={<FournisseursList />} />
              <Route path="produits" element={<ProduitsList />} />
              <Route path="factures" element={<FacturesList />} />
              <Route path="ventes-passagers" element={<VentesPassagers />} />
              <Route path="avoirs" element={<AvoirsList />} />
              <Route path="devis" element={<DevisList />} />
              <Route path="bons-commande" element={<BonsCommandeList />} />
              <Route path="bons-livraison" element={<BonsLivraisonList />} />
              <Route path="bons-livraison-client" element={<BonsLivraisonClientList />} />
              <Route path="depenses" element={<DepensesList />} />
              <Route path="avoirs-fournisseur" element={<AvoirsFournisseurList />} />
              <Route path="parametres" element={<Parametres />} />
              <Route path="database" element={<DatabaseManager />} />
              <Route path="sql-editor" element={<SqlEditor />} />
              <Route path="transactions" element={<TransactionsList />} />
              <Route path="portefeuille" element={<Portefeuille />} />
              <Route path="*" element={<div className="p-8 text-center text-muted-foreground">Page en cours de développement</div>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster />
      </NotificationsProvider>
      </ThemeProvider>
    </AuthProvider>
    </DirectionProvider>
  );
}
