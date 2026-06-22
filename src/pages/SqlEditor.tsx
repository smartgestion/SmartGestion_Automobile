import { useState } from 'react'
import { Terminal, Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function SqlEditor() {
  const [sql, setSql] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const executeSql = async () => {
    if (!sql.trim()) {
      toast.error('Veuillez entrer une requête SQL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.details || 'Erreur lors de l\'exécution');
      }

      setResult(data.data || 'Requête exécutée avec succès (aucun résultat retourné)');
      toast.success('Requête SQL exécutée avec succès');
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error('Erreur lors de l\'exécution de la requête');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Éditeur SQL</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Exécutez des requêtes SQL personnalisées pour nettoyer ou modifier la base de données.
        </p>
      </div>

      <Card className="border border-slate-200 shadow-none rounded-[6px]">
        <CardHeader className="border-b border-slate-100 px-4 sm:px-6 py-3 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Terminal className="h-5 w-5 text-[#267E54]" />
            Requête SQL
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Attention : Les requêtes exécutées ici modifient directement la base de données.
            <br/>
            <span className="text-red-500 font-semibold">Note :</span> Pour que cet éditeur fonctionne, vous devez d'abord créer la fonction <code>execute_sql</code> dans votre tableau de bord Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <Textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="DROP TABLE mouvements_stock; ..."
            className="font-mono text-sm h-64 bg-gray-900 text-gray-100 p-4 rounded-md focus-visible:ring-[#267E54]"
            spellCheck={false}
          />
          <div className="flex justify-end">
            <Button 
              onClick={executeSql} 
              disabled={isLoading || !sql.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[4px] shadow-none"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Exécution...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  Exécuter la requête
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(result || error) && (
        <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden">
          <CardHeader className="border-b border-slate-100 px-6 py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {error ? (
                <><AlertCircle className="h-5 w-5 text-red-500" /> Résultat (Erreur)</>
              ) : (
                <><CheckCircle2 className="h-5 w-5 text-[#267E54]" /> Résultat (Succès)</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-gray-50 p-6 overflow-x-auto">
              {error ? (
                <div className="text-red-600 font-mono text-sm whitespace-pre-wrap">
                  {error}
                </div>
              ) : (
                <pre className="text-gray-800 font-mono text-sm whitespace-pre-wrap">
                  {typeof result === 'object' ? JSON.stringify(result, null, 2) : result}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-sky-200 shadow-none rounded-[6px] bg-sky-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Exemples de requêtes de nettoyage :</h3>
          <ul className="list-disc pl-5 space-y-2 text-sm text-blue-800">
            <li>
              <strong>Créer la fonction execute_sql (à exécuter dans Supabase) :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded block mt-1 whitespace-pre-wrap">
                DROP FUNCTION IF EXISTS execute_sql(text);
                
                CREATE OR REPLACE FUNCTION execute_sql(sql text)
                RETURNS json
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                DECLARE
                  result json;
                BEGIN
                  EXECUTE sql;
                  RETURN json_build_object('status', 'success');
                EXCEPTION WHEN OTHERS THEN
                  RETURN json_build_object('status', 'error', 'message', SQLERRM);
                END;
                $$;
              </code>
            </li>
            <li>
              <strong>Créer la table produits :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded block mt-1 whitespace-pre-wrap">
                CREATE TABLE IF NOT EXISTS produits (
                  id BIGSERIAL PRIMARY KEY,
                  reference TEXT UNIQUE,
                  nom TEXT NOT NULL,
                  description TEXT,
                  categorie TEXT,
                  prix_achat_ht DECIMAL(12,2) DEFAULT 0,
                  prix_vente_ht DECIMAL(12,2) DEFAULT 0,
                  prix_achat_ttc DECIMAL(12,2) DEFAULT 0,
                  prix_vente_ttc DECIMAL(12,2) DEFAULT 0,
                  tva DECIMAL(5,2) DEFAULT 20,
                  stock_actuel DECIMAL(12,2) DEFAULT 0,
                  stock_min DECIMAL(12,2) DEFAULT 5,
                  unite TEXT DEFAULT 'unité',
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
              </code>
            </li>
            <li>
              <strong>Créer la table mouvements_stock :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded block mt-1 whitespace-pre-wrap">
                CREATE TABLE IF NOT EXISTS mouvements_stock (
                  id BIGSERIAL PRIMARY KEY,
                  produit_id BIGINT REFERENCES produits(id) ON DELETE CASCADE,
                  type TEXT NOT NULL,
                  quantite DECIMAL(12,2) NOT NULL,
                  date_mouvement TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                  reference_document TEXT,
                  entite_nom TEXT,
                  prix_unitaire DECIMAL(12,2),
                  notes TEXT
                );
              </code>
            </li>
            <li>
              <strong>Supprimer toutes les données des produits (Attention !) :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded">TRUNCATE TABLE produits CASCADE;</code>
            </li>
            <li>
              <strong>Supprimer la table mouvements_stock :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded">DROP TABLE IF EXISTS mouvements_stock;</code>
            </li>
            <li>
              <strong>Supprimer la colonne stock_updated des factures :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded">ALTER TABLE factures DROP COLUMN IF EXISTS stock_updated;</code>
            </li>
            <li>
              <strong>Supprimer la colonne stock_updated des bons de commande :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded">ALTER TABLE bons_commande DROP COLUMN IF EXISTS stock_updated;</code>
            </li>
            <li>
              <strong>Supprimer la colonne stock_updated des bons de livraison :</strong><br/>
              <code className="bg-blue-100 px-1 py-0.5 rounded">ALTER TABLE bons_livraison DROP COLUMN IF EXISTS stock_updated;</code>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
