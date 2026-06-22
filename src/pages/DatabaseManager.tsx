import { useState, useEffect } from 'react'
import { Database, Search, RefreshCw, Trash2, AlertCircle, Play, Code } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const TABLES = [
  'clients',
  'fournisseurs',
  'produits',
  'factures',
  'facture_lignes',
  'devis',
  'devis_lignes',
  'bons_commande',
  'bon_commande_lignes',
  'bons_livraison',
  'bon_livraison_lignes',
  'depenses',
  'parametres_entreprise',
  'mouvements_stock'
];

export function DatabaseManager() {
  const [selectedTable, setSelectedTable] = useState(TABLES[0]);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<any>(null);

  // SQL Editor State
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResults, setSqlResults] = useState<any[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [isSqlLoading, setIsSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: tableData, error } = await supabase
        .from(selectedTable)
        .select('*')
        .limit(100);

      if (error) throw error;

      if (tableData && tableData.length > 0) {
        setColumns(Object.keys(tableData[0]));
        setData(tableData);
      } else {
        setColumns([]);
        setData([]);
      }
    } catch (error: any) {
      console.error('Error fetching table data:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedTable]);

  const handleDelete = async () => {
    if (!rowToDelete) return;

    try {
      const { error } = await supabase
        .from(selectedTable)
        .delete()
        .eq('id', rowToDelete);

      if (error) throw error;

      toast.success('Ligne supprimée');
      fetchData();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const executeSql = async () => {
    if (!sqlQuery.trim()) return;
    
    setIsSqlLoading(true);
    setSqlError(null);
    setSqlResults([]);
    setSqlColumns([]);
    
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: sqlQuery
      });
      
      if (error) throw error;
      
      if (data && Array.isArray(data) && data.length > 0) {
        setSqlColumns(Object.keys(data[0]));
        setSqlResults(data);
        toast.success(`${data.length} ligne(s) retournée(s)`);
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        setSqlColumns(Object.keys(data));
        setSqlResults([data]);
        toast.success('Requête exécutée avec succès');
      } else {
        toast.success('Requête exécutée avec succès (aucun résultat à afficher)');
      }
    } catch (error: any) {
      console.error('Error executing SQL:', error);
      setSqlError(error.message);
      toast.error(`Erreur SQL: ${error.message}`);
    } finally {
      setIsSqlLoading(false);
    }
  };

  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  return (
    <div className="space-y-6">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer la ligne"
        description="Êtes-vous sûr de vouloir supprimer cette ligne ? Cette action est irréversible."
      />
      {/* Page header — text scales for phones, subtitle wraps */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">Gestionnaire de Base de Données</h2>
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
            Visualisez et gérez les données brutes de vos tables ou exécutez des requêtes SQL.
          </p>
        </div>
      </div>

      <Tabs defaultValue="explorer" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="explorer" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Explorateur de tables
          </TabsTrigger>
          <TabsTrigger value="sql" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Éditeur SQL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explorer" className="space-y-4">
          {/* Toolbar — stacks vertically below sm; search becomes
              full-width on mobile so it's tappable. */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Choisir une table" />
                </SelectTrigger>
                <SelectContent>
                  {TABLES.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
            <div className="relative w-full sm:flex-1 sm:max-w-sm sm:ml-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher dans les données..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-[6px] border border-slate-200 bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p>Aucune donnée trouvée dans la table {selectedTable}.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, i) => (
                    <TableRow key={row.id || i}>
                      {columns.map((col) => (
                        <TableCell key={col} className="max-w-[200px] truncate">
                          {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => {
                            setRowToDelete(row.id);
                            setDeleteConfirmOpen(true);
                          }}
                          disabled={!row.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="sql" className="space-y-4">
          <div className="grid gap-4">
            <div className="rounded-[6px] border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Éditeur de Requête SQL</h3>
                  <p className="text-sm text-muted-foreground">Exécutez des requêtes SELECT, UPDATE, INSERT ou DELETE directement sur votre base de données.</p>
                </div>
                  <Button 
                    onClick={executeSql} 
                    disabled={isSqlLoading || !sqlQuery.trim()} 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[4px] shadow-none"
                  >
                  <Play className="mr-2 h-4 w-4" />
                  Exécuter
                </Button>
              </div>
              <Textarea 
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM factures LIMIT 10;"
                className="font-mono text-sm min-h-[200px] bg-slate-50 border-slate-200 focus-visible:ring-[#267E54]"
                spellCheck={false}
              />
              {sqlError && (
                <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md text-sm border border-red-100 flex items-start">
                  <AlertCircle className="mr-2 h-5 w-5 shrink-0 mt-0.5" />
                  <div className="whitespace-pre-wrap font-mono text-xs">{sqlError}</div>
                </div>
              )}
            </div>

            <div className="rounded-[6px] border border-slate-200 bg-white overflow-x-auto min-h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {sqlColumns.map((col) => (
                      <TableHead key={col} className="bg-slate-50 font-semibold">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isSqlLoading ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(sqlColumns.length, 1)} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <RefreshCw className="h-6 w-6 mb-2 animate-spin text-[#267E54]" />
                          <p>Exécution de la requête...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sqlResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(sqlColumns.length, 1)} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center">
                          <Database className="h-8 w-8 mb-2 opacity-20" />
                          <p>Aucun résultat ou requête non exécutée.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sqlResults.map((row, i) => (
                      <TableRow key={i} className="hover:bg-slate-50">
                        {sqlColumns.map((col) => (
                          <TableCell key={col} className="max-w-[400px] truncate">
                            {row[col] === null ? (
                              <span className="text-slate-400 italic">null</span>
                            ) : typeof row[col] === 'object' ? (
                              <span className="font-mono text-xs text-blue-600">{JSON.stringify(row[col])}</span>
                            ) : typeof row[col] === 'boolean' ? (
                              <span className={`font-mono text-xs ${row[col] ? 'text-green-600' : 'text-red-600'}`}>{String(row[col])}</span>
                            ) : (
                              String(row[col])
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

