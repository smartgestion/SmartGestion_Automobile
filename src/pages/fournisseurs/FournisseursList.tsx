import React, { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Search, FileEdit, Trash2, Truck, Building2, User,
  ChevronLeft, ChevronRight, Mail, Phone, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

import { toast } from 'sonner'
import { FournisseurForm } from '@/components/forms/FournisseurForm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Fournisseur {
  id: number;
  code: string;
  nom: string;
  nomSociete?: string;
  type: string;
  email: string;
  telephone: string;
  ice: string | null;
  adresse?: string;
  ville?: string;
}

const ITEMS_PER_PAGE = 10;

export function FournisseursList() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingFournisseur, setEditingFournisseur] = useState<Fournisseur | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fournisseurToDelete, setFournisseurToDelete] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchFournisseurs = async () => {
    if (!user?.id) {
      setFournisseurs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const result = await supabase
        .from('fournisseurs')
        .select('*')
        .eq('user_id', user.id);

      if (result.error) {
        toast.error(t('fournisseurs.toast_load_error'));
        setFournisseurs([]);
        setIsLoading(false);
        return;
      }

      setFournisseurs(result.data || []);
    } catch (error: any) {
      console.error('Catch error:', error);
      setFournisseurs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchFournisseurs();
    }
  }, [user?.id]);

  const handleDelete = async () => {
    if (!fournisseurToDelete || !user?.id) return;
    try {
      const { error } = await supabase
        .from('fournisseurs')
        .delete()
        .eq('id', fournisseurToDelete)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success(t('fournisseurs.toast_deleted'));
      fetchFournisseurs();
    } catch (error) {
      toast.error(t('fournisseurs.toast_load_error'));
    } finally {
      setDeleteConfirmOpen(false);
      setFournisseurToDelete(null);
    }
  };

  const handleEdit = (fournisseur: Fournisseur) => {
    setEditingFournisseur(fournisseur);
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingFournisseur(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingFournisseur(null);
  };

  const filteredFournisseurs = useMemo(() => {
    if (!searchQuery.trim()) return fournisseurs;
    const query = searchQuery.toLowerCase();
    return fournisseurs.filter((fournisseur) => {
      const nom = fournisseur.nom || fournisseur.nomSociete || '';
      return (
        nom.toLowerCase().includes(query) ||
        (fournisseur.code && fournisseur.code.toLowerCase().includes(query)) ||
        (fournisseur.email && fournisseur.email.toLowerCase().includes(query)) ||
        (fournisseur.telephone && fournisseur.telephone.includes(query))
      );
    });
  }, [fournisseurs, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredFournisseurs.length / ITEMS_PER_PAGE));
  const paginatedFournisseurs = filteredFournisseurs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const fournisseursCount = fournisseurs.length;
  const entreprisesCount = fournisseurs.filter(f => f.type === 'entreprise').length;
  const particuliersCount = fournisseurs.filter(f => f.type !== 'entreprise').length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title={t('shared.confirm_delete.title_supplier')}
        description={t('shared.confirm_delete.body_supplier')}
      />

      {showForm ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeForm}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {editingFournisseur ? t('fournisseurs.dialog_edit') : t('fournisseurs.dialog_create')}
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {editingFournisseur ? t('fournisseurs.dialog_subtitle_edit', { name: editingFournisseur.nom || editingFournisseur.nomSociete }) : t('fournisseurs.dialog_subtitle_create')}
              </p>
            </div>
          </div>
          <div className="rounded-sm dark:bg-card dark:border-white/10 border border-slate-200 bg-white p-4 sm:p-6">
            <FournisseurForm
              initialData={editingFournisseur}
              onSuccess={() => {
                closeForm();
                fetchFournisseurs();
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Header — stacks below sm, button becomes full-width on mobile */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center h-10 w-10 rounded-[6px] bg-sky-50 border border-sky-200/50 dark:bg-[#0F172A]/60 dark:border-white/10 shrink-0">
                <Truck className="h-5 w-5 text-sky-500 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">{t('fournisseurs.page_title')}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {t('fournisseurs.page_subtitle')}
                </p>
              </div>
            </div>
            <Button
              onClick={openNewForm}
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-[4px] h-10 px-5 shadow-none"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('fournisseurs.new_button')}
            </Button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left Column - Table */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Search — full-width on mobile, max-w-md from sm+ */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none dark:text-slate-500" />
            <Input
              type="text"
              placeholder={t('fournisseurs.search_ph')}
              className="pl-9 h-10 bg-white border-slate-200 rounded-[4px] focus:border-slate-300 shadow-none text-sm dark:bg-[#0F172A] dark:border-white/10 dark:text-white dark:placeholder:text-slate-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Table — wrapped in `overflow-x-auto` for mobile horizontal scroll */}
          <Card className="border border-slate-200 shadow-none rounded-[6px] overflow-hidden dark:bg-[#0F172A] dark:border-white/10">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 dark:border-white/10">
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 w-[120px] dark:text-slate-400">{t('fournisseurs.col_code')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('fournisseurs.col_supplier')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('fournisseurs.col_type')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('fournisseurs.col_contact')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 dark:text-slate-400">{t('fournisseurs.col_ice')}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3 text-right dark:text-slate-400">{t('fournisseurs.col_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground font-medium">{t('fournisseurs.loading')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedFournisseurs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="bg-slate-50 rounded-[6px] p-4 border border-slate-100 dark:bg-[#0F172A]/40 dark:border-white/10">
                          <Truck className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">
                          {searchQuery ? t('fournisseurs.empty_filtered') : t('fournisseurs.empty_all')}
                        </p>
                        {!searchQuery && (
                          <Button
                            variant="outline"
                            className="rounded-[4px] text-sm"
                            onClick={openNewForm}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            {t('fournisseurs.create_first')}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedFournisseurs.map((fournisseur) => {
                    const displayName = fournisseur.nom || fournisseur.nomSociete || '-';
                    const initials = displayName.charAt(0).toUpperCase();

                    return (
                      <TableRow
                        key={fournisseur.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors dark:border-white/10 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-4 py-5">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {fournisseur.code || `F${fournisseur.id}`}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm" className="h-7 w-7 border border-slate-200 dark:border-white/10">
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`} />
                              <AvatarFallback className="text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">{displayName}</p>
                              {(fournisseur.adresse || fournisseur.ville) && (
                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 dark:text-slate-500">
                                  <MapPin className="h-3 w-3" />
                                  {fournisseur.ville || fournisseur.adresse}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium",
                            fournisseur.type === 'entreprise'
                              ? "bg-sky-50 text-sky-700 border border-sky-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                              : "bg-amber-50 text-amber-700 border border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                          )}>
                            {fournisseur.type === 'entreprise' ? (
                              <Building2 className="h-3 w-3 mr-1" />
                            ) : (
                              <User className="h-3 w-3 mr-1" />
                            )}
                            {fournisseur.type === 'entreprise' ? t('fournisseurs.type_company') : t('fournisseurs.type_individual')}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <div className="space-y-0.5">
                            {fournisseur.email && (
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 dark:text-slate-400">
                                <Mail className="h-3 w-3 text-slate-400 shrink-0 dark:text-slate-500" />
                                {fournisseur.email}
                              </p>
                            )}
                            {fournisseur.telephone && (
                              <p className="text-xs text-slate-500 flex items-center gap-1.5 dark:text-slate-400">
                                <Phone className="h-3 w-3 text-slate-400 shrink-0 dark:text-slate-500" />
                                {fournisseur.telephone}
                              </p>
                            )}
                            {!fournisseur.email && !fournisseur.telephone && (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-5">
                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                            {fournisseur.ice || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-5 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[4px] dark:text-slate-500 dark:hover:text-white dark:hover:bg-white/5"
                              onClick={() => handleEdit(fournisseur)}
                              title={t('shared.actions.edit')}
                            >
                              <FileEdit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[4px] dark:text-slate-500 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                              onClick={() => {
                                setFournisseurToDelete(fournisseur.id);
                                setDeleteConfirmOpen(true);
                              }}
                              title={t('shared.actions.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>

            {!isLoading && paginatedFournisseurs.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/10">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredFournisseurs.length)} {t('shared.pagination.of')} {filteredFournisseurs.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 min-w-[32px] rounded-[4px] text-sm font-medium",
                        page === currentPage
                          ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-white"
                          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:text-slate-500 dark:hover:text-white dark:hover:bg-white/5"
                      )}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-[4px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/5"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border border-slate-200 shadow-none rounded-[6px] dark:bg-[#0F172A] dark:border-white/10">
            <CardHeader className="px-4 py-4 border-b border-slate-100 dark:border-white/10">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('fournisseurs.sidebar_title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-4 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-[6px] bg-sky-50 border border-sky-200/50 shrink-0 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                  <Truck className="h-4 w-4 text-sky-500 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('fournisseurs.sidebar_total')}</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-white" dir="ltr">{fournisseursCount}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-sky-500 dark:text-blue-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('fournisseurs.sidebar_companies')}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dir="ltr">{entreprisesCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('fournisseurs.sidebar_individuals')}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300" dir="ltr">{particuliersCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
