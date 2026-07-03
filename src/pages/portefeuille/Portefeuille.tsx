import { useEffect, useState, useCallback, useMemo, useRef, type ElementType, type DragEvent as ReactDragEvent, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Folder, FolderPlus, Upload, FilePlus2, Search, ChevronRight, Home,
  MoreVertical, Pencil, Trash2, Download, Move, Star, Eye, X,
  FileText, FileImage, FileSpreadsheet, File as FileIcon, Loader2,
  Grid3x3, Clock, RotateCcw, Star as StarIcon, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatDate } from '@/lib/utils'
import { PaperEditor } from './PaperEditor'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Folder_ {
  id: number
  name: string
  parent_id: number | null
  is_favorite: number
  is_deleted: number
  created_at: string
  updated_at: string
}
interface Item {
  id: number
  folder_id: number | null
  kind: 'file' | 'paper'
  name: string
  mime_type: string | null
  file_ext: string | null
  size_bytes: number
  content: string | null
  tags: string | null
  is_favorite: number
  is_deleted: number
  last_opened_at: string | null
  created_at: string
  updated_at: string
}

type ViewKey = 'all' | 'favorites' | 'recent' | 'trash'
type Cb = () => unknown

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB
const ACCEPTED = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function extOf(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/)
  return m ? m[1].toLowerCase() : ''
}

function iconForExt(ext: string) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return FileImage
  if (ext === 'pdf') return FileText
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet
  if (['doc', 'docx'].includes(ext)) return FileText
  return FileIcon
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Portefeuille() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'fr'
  const isRTL = lang.startsWith('ar')
  const tp = (k: string, o?: any): string => t(`portefeuille.${k}`, o) as string

  const [folders, setFolders] = useState<Folder_[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<ViewKey>('all')
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Dialogs / editor
  const [nameDialog, setNameDialog] = useState<
    | { mode: 'new_folder' }
    | { mode: 'new_paper' }
    | { mode: 'rename_folder'; target: Folder_ }
    | { mode: 'rename_item'; target: Item }
    | null
  >(null)
  const [nameInput, setNameInput] = useState('')
  const [moveTarget, setMoveTarget] = useState<{ type: 'folder' | 'item'; id: number } | null>(null)
  const [preview, setPreview] = useState<Item | null>(null)
  const [editingPaper, setEditingPaper] = useState<Item | null>(null)
  const [confirm, setConfirm] = useState<
    | { kind: 'trash_folder'; id: number }
    | { kind: 'trash_item'; id: number }
    | { kind: 'purge_folder'; id: number }
    | { kind: 'purge_item'; id: number }
    | null
  >(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    try {
      const [fRes, iRes] = await Promise.all([
        supabase.from('portefeuille_folders').select('*').eq('user_id', user.id).order('name'),
        // Exclude the (potentially huge) `content` column from the list query for speed;
        // it's fetched on demand when previewing/editing.
        supabase.from('portefeuille_items')
          .select('id, folder_id, kind, name, mime_type, file_ext, size_bytes, tags, is_favorite, is_deleted, last_opened_at, created_at, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
      ])
      setFolders(fRes.data || [])
      setItems((iRes.data || []).map((r: any) => ({ ...r, content: null })))
    } catch (e) {
      console.error('Portefeuille load error', e)
      toast.error(tp('toast.error'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { load() }, [load])

  // ── Derived lists per view ─────────────────────────────────────────────────
  const currentFolder = folders.find((f) => f.id === currentFolderId) || null

  const breadcrumbs = useMemo(() => {
    const chain: Folder_[] = []
    let node = currentFolder
    const guard = new Set<number>()
    while (node && !guard.has(node.id)) {
      guard.add(node.id)
      chain.unshift(node)
      node = folders.find((f) => f.id === node!.parent_id) || null
    }
    return chain
  }, [currentFolder, folders])

  const q = search.trim().toLowerCase()

  const visibleFolders = useMemo(() => {
    if (view !== 'all') return [] // folders only shown in the tree/all view
    let list = folders.filter((f) => !f.is_deleted)
    if (q) return list.filter((f) => f.name.toLowerCase().includes(q))
    return list.filter((f) => (f.parent_id ?? null) === currentFolderId)
  }, [folders, view, q, currentFolderId])

  const visibleItems = useMemo(() => {
    let list = items
    if (view === 'trash') list = list.filter((i) => i.is_deleted)
    else list = list.filter((i) => !i.is_deleted)

    if (view === 'favorites') list = list.filter((i) => i.is_favorite)
    if (view === 'recent') {
      list = list
        .filter((i) => i.last_opened_at)
        .sort((a, b) => String(b.last_opened_at).localeCompare(String(a.last_opened_at)))
        .slice(0, 30)
    }
    if (q) {
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) || (i.tags || '').toLowerCase().includes(q),
      )
    } else if (view === 'all') {
      list = list.filter((i) => (i.folder_id ?? null) === currentFolderId)
    }
    return list
  }, [items, view, q, currentFolderId])

  const trashCount = items.filter((i) => i.is_deleted).length + folders.filter((f) => f.is_deleted).length

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createFolder = async (name: string) => {
    const { error } = await supabase.from('portefeuille_folders').insert([{
      name, parent_id: currentFolderId, user_id: user?.id,
    }])
    if (error) return toast.error(tp('toast.error'))
    toast.success(tp('toast.folder_created'))
    load()
  }

  const createPaper = async (name: string) => {
    const { data, error } = await supabase.from('portefeuille_items').insert([{
      folder_id: currentFolderId, kind: 'paper', name, content: '',
      file_ext: 'paper', mime_type: 'text/html', size_bytes: 0,
      last_opened_at: new Date().toISOString(), user_id: user?.id,
    }]).select()
    if (error) return toast.error(tp('toast.error'))
    toast.success(tp('toast.paper_created'))
    await load()
    // Open the newly created paper for editing.
    const created = Array.isArray(data) ? data[0] : data
    if (created?.id) openPaper({ ...(created as Item), content: '' })
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user?.id) return
    const arr = Array.from(files)
    if (!arr.length) return
    setUploading(true)
    try {
      let ok = 0
      for (const file of arr) {
        if (file.size > MAX_FILE_BYTES) { toast.error(`${file.name}: ${tp('toast.file_too_large')}`); continue }
        const dataUrl = await fileToDataUrl(file)
        const { error } = await supabase.from('portefeuille_items').insert([{
          folder_id: currentFolderId, kind: 'file', name: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_ext: extOf(file.name), size_bytes: file.size,
          content: dataUrl, user_id: user?.id,
        }])
        if (!error) ok++
      }
      if (ok) toast.success(tp('toast.uploaded'))
      await load()
    } catch (e) {
      console.error(e); toast.error(tp('toast.error'))
    } finally {
      setUploading(false)
    }
  }

  const renameFolder = async (f: Folder_, name: string) => {
    const { error } = await supabase.from('portefeuille_folders').update({ name, updated_at: new Date().toISOString() }).eq('id', f.id).eq('user_id', user?.id)
    if (error) return toast.error(tp('toast.error'))
    toast.success(tp('toast.renamed')); load()
  }
  const renameItem = async (it: Item, name: string) => {
    const { error } = await supabase.from('portefeuille_items').update({ name, updated_at: new Date().toISOString() }).eq('id', it.id).eq('user_id', user?.id)
    if (error) return toast.error(tp('toast.error'))
    toast.success(tp('toast.renamed')); load()
  }

  const toggleFavFolder = async (f: Folder_) => {
    await supabase.from('portefeuille_folders').update({ is_favorite: f.is_favorite ? 0 : 1 }).eq('id', f.id).eq('user_id', user?.id)
    load()
  }
  const toggleFavItem = async (it: Item) => {
    await supabase.from('portefeuille_items').update({ is_favorite: it.is_favorite ? 0 : 1 }).eq('id', it.id).eq('user_id', user?.id)
    load()
  }

  const setDeletedFolder = async (id: number, deleted: boolean) => {
    // Cascade the soft-delete flag to the folder's descendants + their items.
    const descendants = collectDescendantFolderIds(id, folders)
    const all = [id, ...descendants]
    await Promise.all([
      ...all.map((fid) => supabase.from('portefeuille_folders').update({ is_deleted: deleted ? 1 : 0 }).eq('id', fid).eq('user_id', user?.id)),
      supabase.from('portefeuille_items').update({ is_deleted: deleted ? 1 : 0 }).in('folder_id', all),
    ])
    toast.success(deleted ? tp('toast.deleted') : tp('toast.restored')); load()
  }
  const setDeletedItem = async (id: number, deleted: boolean) => {
    await supabase.from('portefeuille_items').update({ is_deleted: deleted ? 1 : 0 }).eq('id', id).eq('user_id', user?.id)
    toast.success(deleted ? tp('toast.deleted') : tp('toast.restored')); load()
  }
  const purgeFolder = async (id: number) => {
    const all = [id, ...collectDescendantFolderIds(id, folders)]
    await Promise.all([
      supabase.from('portefeuille_items').delete().in('folder_id', all),
      ...all.map((fid) => supabase.from('portefeuille_folders').delete().eq('id', fid).eq('user_id', user?.id)),
    ])
    toast.success(tp('toast.purged')); load()
  }
  const purgeItem = async (id: number) => {
    await supabase.from('portefeuille_items').delete().eq('id', id).eq('user_id', user?.id)
    toast.success(tp('toast.purged')); load()
  }

  const moveEntity = async (dest: number | null) => {
    if (!moveTarget) return
    if (moveTarget.type === 'folder') {
      if (dest === moveTarget.id || collectDescendantFolderIds(moveTarget.id, folders).includes(dest as number)) {
        return toast.error(tp('toast.error')) // can't move into itself/descendant
      }
      await supabase.from('portefeuille_folders').update({ parent_id: dest }).eq('id', moveTarget.id).eq('user_id', user?.id)
    } else {
      await supabase.from('portefeuille_items').update({ folder_id: dest }).eq('id', moveTarget.id).eq('user_id', user?.id)
    }
    setMoveTarget(null); toast.success(tp('toast.moved')); load()
  }

  // ── Open / preview / download ────────────────────────────────────────────
  const fetchContent = async (id: number): Promise<string> => {
    const { data } = await supabase.from('portefeuille_items').select('content').eq('id', id).eq('user_id', user?.id).single()
    return data?.content || ''
  }

  const openItem = async (it: Item) => {
    await supabase.from('portefeuille_items').update({ last_opened_at: new Date().toISOString() }).eq('id', it.id).eq('user_id', user?.id)
    if (it.kind === 'paper') openPaper(it)
    else {
      const content = await fetchContent(it.id)
      setPreview({ ...it, content })
    }
  }

  const openPaper = async (it: Item) => {
    const content = it.content != null ? it.content : await fetchContent(it.id)
    setEditingPaper({ ...it, content })
  }

  const savePaper = async (html: string) => {
    if (!editingPaper) return
    await supabase.from('portefeuille_items').update({
      content: html, size_bytes: new Blob([html]).size, updated_at: new Date().toISOString(),
    }).eq('id', editingPaper.id).eq('user_id', user?.id)
  }

  const downloadItem = async (it: Item) => {
    const content = it.content != null ? it.content : await fetchContent(it.id)
    const a = document.createElement('a')
    if (it.kind === 'paper') {
      const blob = new Blob([content], { type: 'text/html' })
      a.href = URL.createObjectURL(blob)
      a.download = it.name.endsWith('.html') ? it.name : `${it.name}.html`
    } else {
      a.href = content // data URL
      a.download = it.name
    }
    document.body.appendChild(a); a.click(); a.remove()
    if (it.kind === 'paper') setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  // ── Drag & drop upload ─────────────────────────────────────────────────────
  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (view === 'trash') return
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files)
  }

  // ── Name dialog submit ──────────────────────────────────────────────────────
  const submitName = () => {
    const name = nameInput.trim()
    if (!name || !nameDialog) return setNameDialog(null)
    const d = nameDialog
    setNameDialog(null); setNameInput('')
    if (d.mode === 'new_folder') createFolder(name)
    else if (d.mode === 'new_paper') createPaper(name)
    else if (d.mode === 'rename_folder') renameFolder(d.target, name)
    else if (d.mode === 'rename_item') renameItem(d.target, name)
  }

  const openNameDialog = (d: NonNullable<typeof nameDialog>) => {
    setNameDialog(d)
    setNameInput(
      d.mode === 'rename_folder' ? d.target.name
        : d.mode === 'rename_item' ? d.target.name
          : d.mode === 'new_paper' ? tp('untitled_paper')
            : '',
    )
  }

  // If a paper is open, render the full-screen editor.
  if (editingPaper) {
    return (
      <div className="h-[calc(100vh-8rem)]">
        <PaperEditor
          name={editingPaper.name}
          initialHtml={editingPaper.content || ''}
          onSave={savePaper}
          onRename={async (name) => { await renameItem(editingPaper, name); setEditingPaper((p) => p ? { ...p, name } : p) }}
          onBack={() => { setEditingPaper(null); load() }}
        />
      </div>
    )
  }

  const VIEWS: { key: ViewKey; label: string; icon: ElementType }[] = [
    { key: 'all', label: tp('views.all'), icon: Grid3x3 },
    { key: 'favorites', label: tp('views.favorites'), icon: StarIcon },
    { key: 'recent', label: tp('views.recent'), icon: Clock },
    { key: 'trash', label: tp('views.trash'), icon: Trash2 },
  ]

  const showEmpty = !loading && visibleFolders.length === 0 && visibleItems.length === 0

  return (
    <div
      className="space-y-4"
      dir={isRTL ? 'rtl' : 'ltr'}
      onDragOver={(e) => { if (view !== 'trash') { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false) }}
      onDrop={onDrop}
    >
      {/* Header + toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </span>
          <h1 className="text-lg font-bold text-foreground">{tp('title')}</h1>
        </div>
        {view === 'all' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => openNameDialog({ mode: 'new_folder' })} className="gap-1.5">
              <FolderPlus className="h-4 w-4" /> {tp('new_folder')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {tp('upload_file')}
            </Button>
            <Button size="sm" onClick={() => openNameDialog({ mode: 'new_paper' })} className="gap-1.5">
              <FilePlus2 className="h-4 w-4" /> {tp('new_paper')}
            </Button>
            <input
              ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden"
              onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = '' }}
            />
          </div>
        )}
      </div>

      {/* View tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-input bg-background w-fit">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => { setView(v.key); setSearch('') }}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded-md transition-all inline-flex items-center gap-1.5',
                view === v.key ? 'bg-[#0EA5E9] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
              {v.key === 'trash' && trashCount > 0 && (
                <span className="ms-0.5 rounded-full bg-rose-500/90 text-white text-[9px] px-1.5 py-0.5">{trashCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tp('search_placeholder')} className="h-9 ps-8" />
        </div>
      </div>

      {/* Breadcrumbs (only in 'all' view without search) */}
      {view === 'all' && !q && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button onClick={() => setCurrentFolderId(null)} className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors', currentFolderId === null ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
            <Home className="h-3.5 w-3.5" /> {tp('root')}
          </button>
          {breadcrumbs.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
              <button onClick={() => setCurrentFolderId(f.id)} className={cn('px-2 py-1 rounded-md hover:bg-muted transition-colors', currentFolderId === f.id ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                {f.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trash: empty-trash action */}
      {view === 'trash' && trashCount > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5 text-rose-600 dark:text-rose-400"
            onClick={async () => {
              await Promise.all([
                ...folders.filter((f) => f.is_deleted).map((f) => purgeFolder(f.id)),
              ])
              const delItems = items.filter((i) => i.is_deleted)
              await Promise.all(delItems.map((i) => supabase.from('portefeuille_items').delete().eq('id', i.id).eq('user_id', user?.id)))
              toast.success(tp('toast.purged')); load()
            }}>
            <Trash2 className="h-4 w-4" /> {tp('empty_trash')}
          </Button>
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="p-4 sm:p-5 min-h-[300px] relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
            </div>
          ) : showEmpty ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              {view === 'trash' ? <Trash2 className="h-10 w-10 text-muted-foreground/40 mb-3" /> :
                view === 'favorites' ? <StarIcon className="h-10 w-10 text-muted-foreground/40 mb-3" /> :
                  view === 'recent' ? <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" /> :
                    <Folder className="h-10 w-10 text-muted-foreground/40 mb-3" />}
              <p className="text-sm font-semibold text-foreground">
                {view === 'trash' ? tp('trash_empty') : view === 'favorites' ? tp('favorites_empty') : view === 'recent' ? tp('recent_empty') : tp('empty_title')}
              </p>
              {view === 'all' && !q && <p className="text-xs text-muted-foreground mt-1">{tp('empty_hint')}</p>}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Folders */}
              {visibleFolders.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{tp('folders')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {visibleFolders.map((f) => (
                      <FolderCard
                        key={f.id} folder={f} tp={tp}
                        onOpen={() => { setCurrentFolderId(f.id); setSearch('') }}
                        onRename={() => openNameDialog({ mode: 'rename_folder', target: f })}
                        onDelete={() => setConfirm({ kind: 'trash_folder', id: f.id })}
                        onMove={() => setMoveTarget({ type: 'folder', id: f.id })}
                        onFav={() => toggleFavFolder(f)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Items */}
              {visibleItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{tp('files')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {visibleItems.map((it) => (
                      <ItemCard
                        key={it.id} item={it} tp={tp} lang={lang} isTrash={view === 'trash'}
                        onOpen={() => openItem(it)}
                        onPreview={() => openItem(it)}
                        onDownload={() => downloadItem(it)}
                        onRename={() => openNameDialog({ mode: 'rename_item', target: it })}
                        onDelete={() => setConfirm({ kind: 'trash_item', id: it.id })}
                        onMove={() => setMoveTarget({ type: 'item', id: it.id })}
                        onFav={() => toggleFavItem(it)}
                        onRestore={() => setDeletedItem(it.id, false)}
                        onPurge={() => setConfirm({ kind: 'purge_item', id: it.id })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Deleted folders in trash view */}
              {view === 'trash' && folders.filter((f) => f.is_deleted).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{tp('folders')}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {folders.filter((f) => f.is_deleted).map((f) => (
                      <div key={f.id} className="rounded-lg border border-border p-3 flex items-center gap-2">
                        <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                        <span className="text-sm font-medium truncate flex-1">{f.name}</span>
                        <button title={tp('restore')} onClick={() => setDeletedFolder(f.id, false)} className="p-1 rounded hover:bg-muted text-muted-foreground"><RotateCcw className="h-4 w-4" /></button>
                        <button title={tp('delete_permanently')} onClick={() => setConfirm({ kind: 'purge_folder', id: f.id })} className="p-1 rounded hover:bg-muted text-rose-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drag overlay */}
          {dragOver && view === 'all' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 text-primary">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-semibold">{tp('drop_here')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Name dialog (create/rename) */}
      <Dialog open={!!nameDialog} onOpenChange={(o) => { if (!o) setNameDialog(null) }}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {nameDialog?.mode === 'new_folder' ? tp('new_folder')
                : nameDialog?.mode === 'new_paper' ? tp('new_paper')
                  : tp('rename')}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitName() }}
            placeholder={nameDialog?.mode?.includes('folder') ? tp('folder_name') : tp('paper_name')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameDialog(null)}>{tp('cancel')}</Button>
            <Button onClick={submitName} disabled={!nameInput.trim()}>
              {nameDialog?.mode?.startsWith('rename') ? tp('rename') : tp('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => { if (!o) setMoveTarget(null) }}>
        <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{tp('move_to')}</DialogTitle></DialogHeader>
          <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
            <button onClick={() => moveEntity(null)} className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted text-start">
              <Home className="h-4 w-4 text-muted-foreground" /> {tp('move_root')}
            </button>
            {folders.filter((f) => !f.is_deleted).map((f) => {
              const disabled = moveTarget?.type === 'folder' && (f.id === moveTarget.id || collectDescendantFolderIds(moveTarget.id, folders).includes(f.id))
              const depth = folderDepth(f, folders)
              return (
                <button
                  key={f.id} disabled={disabled} onClick={() => moveEntity(f.id)}
                  style={{ paddingInlineStart: `${12 + depth * 16}px` }}
                  className={cn('w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-start', disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted')}
                >
                  <Folder className="h-4 w-4 text-amber-500" /> {f.name}
                </button>
              )
            })}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMoveTarget(null)}>{tp('cancel')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File preview */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pe-8 truncate">
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{preview?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
            {preview && <FilePreviewBody item={preview} tp={tp} />}
          </div>
          <DialogFooter>
            {preview && (
              <Button variant="outline" onClick={() => downloadItem(preview)} className="gap-1.5">
                <Download className="h-4 w-4" /> {tp('download')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm (trash / purge) */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null) }}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind?.startsWith('purge') ? tp('confirm_purge_title') : tp('confirm_delete_title')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirm?.kind === 'trash_folder' ? tp('confirm_delete_folder')
              : confirm?.kind === 'trash_item' ? tp('confirm_delete_item')
                : tp('confirm_purge_msg')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{tp('cancel')}</Button>
            <Button variant="destructive" onClick={() => {
              if (!confirm) return
              const c = confirm; setConfirm(null)
              if (c.kind === 'trash_folder') setDeletedFolder(c.id, true)
              else if (c.kind === 'trash_item') setDeletedItem(c.id, true)
              else if (c.kind === 'purge_folder') purgeFolder(c.id)
              else if (c.kind === 'purge_item') purgeItem(c.id)
            }}>
              {confirm?.kind?.startsWith('purge') ? tp('delete_permanently') : tp('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function useMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return { open, setOpen, ref }
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-2 px-3 py-2 text-xs text-start hover:bg-muted transition-colors', danger ? 'text-rose-600 dark:text-rose-400' : 'text-popover-foreground')}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

interface FolderCardProps {
  folder: Folder_; tp: (k: string, o?: any) => string
  onOpen: Cb; onRename: Cb; onDelete: Cb; onMove: Cb; onFav: Cb
}
const FolderCard: FC<FolderCardProps> = ({ folder, tp, onOpen, onRename, onDelete, onMove, onFav }) => {
  const menu = useMenu()
  return (
    <div className="group relative rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all">
      <button onClick={onOpen} className="w-full flex items-center gap-2.5 p-3 text-start">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-500/10 shrink-0">
          <Folder className="h-5 w-5 text-amber-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground truncate">{folder.name}</span>
        </span>
      </button>
      {folder.is_favorite ? <Star className="absolute top-2 end-9 h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
      <div ref={menu.ref} className="absolute top-1.5 end-1.5">
        <button onClick={() => menu.setOpen((o) => !o)} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
          <MoreVertical className="h-4 w-4" />
        </button>
        {menu.open && (
          <div className="absolute end-0 top-full mt-1 z-30 w-40 rounded-md border border-border bg-popover shadow-lg overflow-hidden py-1">
            <MenuItem icon={Star} label={folder.is_favorite ? tp('unfavorite') : tp('favorite')} onClick={() => { menu.setOpen(false); onFav() }} />
            <MenuItem icon={Pencil} label={tp('rename')} onClick={() => { menu.setOpen(false); onRename() }} />
            <MenuItem icon={Move} label={tp('move')} onClick={() => { menu.setOpen(false); onMove() }} />
            <MenuItem icon={Trash2} label={tp('delete')} danger onClick={() => { menu.setOpen(false); onDelete() }} />
          </div>
        )}
      </div>
    </div>
  )
}

interface ItemCardProps {
  item: Item; tp: (k: string, o?: any) => string; lang: string; isTrash: boolean
  onOpen: Cb; onPreview: Cb; onDownload: Cb; onRename: Cb
  onDelete: Cb; onMove: Cb; onFav: Cb; onRestore: Cb; onPurge: Cb
}
const ItemCard: FC<ItemCardProps> = ({ item, tp, lang, isTrash, onOpen, onPreview, onDownload, onRename, onDelete, onMove, onFav, onRestore, onPurge }) => {
  const menu = useMenu()
  const ext = item.file_ext || ''
  const Icon = item.kind === 'paper' ? FileText : iconForExt(ext)
  const tone = item.kind === 'paper'
    ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400'
    : ['pdf'].includes(ext) ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
      : ['xls', 'xlsx', 'csv'].includes(ext) ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'
          : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'

  return (
    <div className="group relative rounded-lg border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all">
      <button onClick={isTrash ? undefined : onOpen} disabled={isTrash} className="w-full flex items-center gap-2.5 p-3 text-start disabled:cursor-default">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-md shrink-0', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground truncate">{item.name}</span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {item.kind === 'paper' ? tp('kind_paper') : `${(ext || '').toUpperCase()} · ${formatBytes(item.size_bytes)}`}
            {' · '}{formatDate(item.updated_at, 'dd/MM/yy', lang)}
          </span>
        </span>
      </button>
      {item.is_favorite ? <Star className="absolute top-2 end-9 h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
      <div ref={menu.ref} className="absolute top-1.5 end-1.5">
        <button onClick={() => menu.setOpen((o) => !o)} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
          <MoreVertical className="h-4 w-4" />
        </button>
        {menu.open && (
          <div className="absolute end-0 top-full mt-1 z-30 w-44 rounded-md border border-border bg-popover shadow-lg overflow-hidden py-1">
            {isTrash ? (
              <>
                <MenuItem icon={RotateCcw} label={tp('restore')} onClick={() => { menu.setOpen(false); onRestore() }} />
                <MenuItem icon={Trash2} label={tp('delete_permanently')} danger onClick={() => { menu.setOpen(false); onPurge() }} />
              </>
            ) : (
              <>
                {item.kind === 'file' && <MenuItem icon={Eye} label={tp('preview')} onClick={() => { menu.setOpen(false); onPreview() }} />}
                {item.kind === 'paper' && <MenuItem icon={Eye} label={tp('open')} onClick={() => { menu.setOpen(false); onOpen() }} />}
                <MenuItem icon={Download} label={tp('download')} onClick={() => { menu.setOpen(false); onDownload() }} />
                <MenuItem icon={Star} label={item.is_favorite ? tp('unfavorite') : tp('favorite')} onClick={() => { menu.setOpen(false); onFav() }} />
                <MenuItem icon={Pencil} label={tp('rename')} onClick={() => { menu.setOpen(false); onRename() }} />
                <MenuItem icon={Move} label={tp('move')} onClick={() => { menu.setOpen(false); onMove() }} />
                <MenuItem icon={Trash2} label={tp('delete')} danger onClick={() => { menu.setOpen(false); onDelete() }} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FilePreviewBody({ item, tp }: { item: Item; tp: (k: string, o?: any) => string }) {
  const content = item.content || ''
  const ext = (item.file_ext || '').toLowerCase()
  const mime = item.mime_type || ''

  if (item.kind === 'paper') {
    return <div className="w-full h-full bg-white text-black p-6 overflow-auto" dangerouslySetInnerHTML={{ __html: content }} />
  }
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
    return <img src={content} alt={item.name} className="max-w-full max-h-[70vh] object-contain" />
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return <iframe src={content} title={item.name} className="w-full h-[70vh] rounded-lg border-0" />
  }
  if (['txt', 'csv'].includes(ext) || mime.startsWith('text/')) {
    let text = ''
    try { text = atob((content.split(',')[1] || '')) } catch { text = '' }
    return <pre className="w-full h-full max-h-[70vh] overflow-auto p-4 text-xs text-foreground whitespace-pre-wrap bg-card">{text}</pre>
  }
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground py-10">
      <FileIcon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{tp('no_preview')}</p>
    </div>
  )
}

// ─── Tree utilities ─────────────────────────────────────────────────────────

function collectDescendantFolderIds(rootId: number, folders: Folder_[]): number[] {
  const out: number[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    for (const f of folders) {
      if (f.parent_id === id) { out.push(f.id); stack.push(f.id) }
    }
  }
  return out
}

function folderDepth(folder: Folder_, folders: Folder_[]): number {
  let depth = 0
  let node: Folder_ | undefined = folder
  const guard = new Set<number>()
  while (node && node.parent_id != null && !guard.has(node.id)) {
    guard.add(node.id)
    node = folders.find((f) => f.id === node!.parent_id)
    depth++
  }
  return depth
}
