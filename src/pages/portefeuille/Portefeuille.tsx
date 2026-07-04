import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect, type ElementType, type ReactNode, type DragEvent as ReactDragEvent, type WheelEvent as ReactWheelEvent, type PointerEvent as ReactPointerEvent, type FC } from 'react'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Folder, FolderPlus, Upload, FilePlus2, Search, ChevronRight, Home,
  MoreVertical, Pencil, Trash2, Download, Move, Star, Eye, X,
  FileText, FileImage, FileSpreadsheet, File as FileIcon, Loader2,
  Grid3x3, Clock, RotateCcw, Star as StarIcon, Layers,
  ZoomIn, ZoomOut, RotateCw,
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
    const toastId = toast.loading(tp('toast.downloading', { name: it.name }))
    try {
      const content = it.content != null ? it.content : await fetchContent(it.id)
      if (!content) throw new Error('empty content')
      const a = document.createElement('a')
      let objectUrl: string | null = null
      if (it.kind === 'paper') {
        const blob = new Blob([content], { type: 'text/html' })
        objectUrl = URL.createObjectURL(blob)
        a.href = objectUrl
        a.download = it.name.endsWith('.html') ? it.name : `${it.name}.html`
      } else {
        a.href = content // data URL
        a.download = it.name
      }
      document.body.appendChild(a); a.click(); a.remove()
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 2000)
      toast.success(tp('toast.downloaded', { name: it.name }), { id: toastId })
    } catch (e) {
      console.error(e)
      toast.error(tp('toast.download_error'), { id: toastId })
    }
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
            <Button size="sm" variant="outline" onClick={() => openNameDialog({ mode: 'new_folder' })} className="gap-2">
              <FolderPlus className="h-4 w-4" /> {tp('new_folder')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {tp('upload_file')}
            </Button>
            <Button
              size="sm"
              onClick={() => openNameDialog({ mode: 'new_paper' })}
              className="gap-2 bg-[#0EA5E9] text-white shadow-sm transition-all hover:bg-[#0284C7] hover:shadow-md active:scale-[0.98]"
            >
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
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
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
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
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
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
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
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
          {(() => {
            const isFolder = !!nameDialog?.mode?.includes('folder')
            const isRename = !!nameDialog?.mode?.startsWith('rename')
            const HeaderIcon = isRename ? Pencil : isFolder ? FolderPlus : FilePlus2
            const title = nameDialog?.mode === 'new_folder' ? tp('new_folder')
              : nameDialog?.mode === 'new_paper' ? tp('new_paper')
                : tp('rename')
            const label = isFolder ? tp('folder_name') : tp('paper_name')
            return (
              <>
                <DialogHeader className="flex-row items-center gap-3 p-5 pb-4">
                  <span className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
                    isFolder
                      ? 'bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400'
                      : 'bg-primary/10 text-primary ring-primary/20',
                  )}>
                    <HeaderIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <DialogTitle className="text-base">{title}</DialogTitle>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </DialogHeader>
                <div className="px-5 pb-5">
                  <Input
                    autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitName() }}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder={label}
                    className="h-11"
                  />
                </div>
                <DialogFooter className="mx-0 mb-0 px-5 py-4">
                  <Button variant="outline" onClick={() => setNameDialog(null)}>{tp('cancel')}</Button>
                  <Button onClick={submitName} disabled={!nameInput.trim()} className="gap-1.5">
                    <HeaderIcon className="h-4 w-4" />
                    {isRename ? tp('rename') : tp('create')}
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
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

      {/* File preview (fullscreen) */}
      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}>
        <DialogContent fullScreen showCloseButton={false} className="bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
          {preview && (
            <FilePreviewViewer
              item={preview} tp={tp}
              onClose={() => setPreview(null)}
              onDownload={() => downloadItem(preview)}
            />
          )}
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

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs text-start transition-colors',
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10'
          : 'text-popover-foreground hover:bg-muted',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" /> {label}
    </button>
  )
}

/**
 * A dropdown menu whose panel is rendered in a portal (document.body) so it is
 * never clipped by a parent with `overflow-hidden` (e.g. the Card). It positions
 * itself under the trigger and flips upward when there isn't enough room below.
 */
function CardMenu({ width = 176, children }: { width?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' }>({ top: 0, left: 0, placement: 'bottom' })
  const isRTL = document.documentElement.dir === 'rtl'

  const place = useCallback(() => {
    const btn = triggerRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const panelH = panelRef.current?.offsetHeight ?? 240
    const gap = 4
    const spaceBelow = window.innerHeight - r.bottom
    const placement: 'top' | 'bottom' = spaceBelow < panelH + gap && r.top > panelH + gap ? 'top' : 'bottom'
    const top = placement === 'bottom' ? r.bottom + gap : r.top - panelH - gap
    // Align the panel's inner edge with the trigger, keep within viewport.
    let left = isRTL ? r.left : r.right - width
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    setPos({ top, left, placement })
  }, [width, isRTL])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onScrollOrResize = () => place()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  return (
    <div className="absolute top-1.5 end-1.5">
      <button
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className={cn(
          'p-1 rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground',
          open ? 'opacity-100 bg-muted' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          onClick={(e) => { e.stopPropagation(); setOpen(false) }}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
          className={cn(
            'z-[100] rounded-lg border border-border bg-popover p-1 shadow-lg',
            'origin-top data-[placement=top]:origin-bottom',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
          data-placement={pos.placement}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}

interface FolderCardProps {
  folder: Folder_; tp: (k: string, o?: any) => string
  onOpen: Cb; onRename: Cb; onDelete: Cb; onMove: Cb; onFav: Cb
}
const FolderCard: FC<FolderCardProps> = ({ folder, tp, onOpen, onRename, onDelete, onMove, onFav }) => {
  return (
    <div className="group relative rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
      <button onClick={onOpen} className="w-full flex items-center gap-3 p-3 pe-9 text-start">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-500/15 dark:bg-amber-500/10 shrink-0">
          <Folder className="h-5 w-5 text-amber-500" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{folder.name}</span>
            {folder.is_favorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
          </span>
          <span className="block text-[11px] text-muted-foreground">{tp('folders').replace(/s$/i, '')}</span>
        </span>
      </button>
      <CardMenu width={176}>
        <MenuItem icon={Star} label={folder.is_favorite ? tp('unfavorite') : tp('favorite')} onClick={onFav} />
        <MenuItem icon={Pencil} label={tp('rename')} onClick={onRename} />
        <MenuItem icon={Move} label={tp('move')} onClick={onMove} />
        <div className="my-1 h-px bg-border" />
        <MenuItem icon={Trash2} label={tp('delete')} danger onClick={onDelete} />
      </CardMenu>
    </div>
  )
}

interface ItemCardProps {
  item: Item; tp: (k: string, o?: any) => string; lang: string; isTrash: boolean
  onOpen: Cb; onPreview: Cb; onDownload: Cb; onRename: Cb
  onDelete: Cb; onMove: Cb; onFav: Cb; onRestore: Cb; onPurge: Cb
}
const ItemCard: FC<ItemCardProps> = ({ item, tp, lang, isTrash, onOpen, onPreview, onDownload, onRename, onDelete, onMove, onFav, onRestore, onPurge }) => {
  const ext = item.file_ext || ''
  const Icon = item.kind === 'paper' ? FileText : iconForExt(ext)
  const tone = item.kind === 'paper'
    ? 'bg-sky-50 text-sky-600 ring-sky-500/15 dark:bg-sky-500/10 dark:text-sky-400'
    : ['pdf'].includes(ext) ? 'bg-rose-50 text-rose-600 ring-rose-500/15 dark:bg-rose-500/10 dark:text-rose-400'
      : ['xls', 'xlsx', 'csv'].includes(ext) ? 'bg-emerald-50 text-emerald-600 ring-emerald-500/15 dark:bg-emerald-500/10 dark:text-emerald-400'
        : ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'bg-violet-50 text-violet-600 ring-violet-500/15 dark:bg-violet-500/10 dark:text-violet-400'
          : 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-white/5 dark:text-slate-300'

  return (
    <div className={cn(
      'group relative rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md',
      !isTrash && 'hover:-translate-y-0.5',
    )}>
      <button onClick={isTrash ? undefined : onOpen} disabled={isTrash} className="w-full flex items-center gap-3 p-3 pe-9 text-start disabled:cursor-default">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset shrink-0', tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{item.name}</span>
            {item.is_favorite ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
          </span>
          <span className="block text-[11px] text-muted-foreground truncate">
            {item.kind === 'paper' ? tp('kind_paper') : `${(ext || '').toUpperCase()} · ${formatBytes(item.size_bytes)}`}
            {' · '}{formatDate(item.updated_at, 'dd/MM/yy', lang)}
          </span>
        </span>
      </button>
      <CardMenu width={isTrash ? 200 : 180}>
        {isTrash ? (
          <>
            <MenuItem icon={RotateCcw} label={tp('restore')} onClick={onRestore} />
            <MenuItem icon={Trash2} label={tp('delete_permanently')} danger onClick={onPurge} />
          </>
        ) : (
          <>
            {item.kind === 'file' && <MenuItem icon={Eye} label={tp('preview')} onClick={onPreview} />}
            {item.kind === 'paper' && <MenuItem icon={Eye} label={tp('open')} onClick={onOpen} />}
            <MenuItem icon={Download} label={tp('download')} onClick={onDownload} />
            <MenuItem icon={Star} label={item.is_favorite ? tp('unfavorite') : tp('favorite')} onClick={onFav} />
            <MenuItem icon={Pencil} label={tp('rename')} onClick={onRename} />
            <MenuItem icon={Move} label={tp('move')} onClick={onMove} />
            <div className="my-1 h-px bg-border" />
            <MenuItem icon={Trash2} label={tp('delete')} danger onClick={onDelete} />
          </>
        )}
      </CardMenu>
    </div>
  )
}

type PreviewCb = () => void

function FilePreviewViewer({ item, tp, onClose, onDownload }: {
  item: Item; tp: (k: string, o?: any) => string; onClose: PreviewCb; onDownload: PreviewCb
}) {
  const content = item.content || ''
  const ext = (item.file_ext || '').toLowerCase()
  const mime = item.mime_type || ''
  const isImage = item.kind === 'file' && (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext))
  const isSpreadsheet = item.kind === 'file' && (['xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'ods'].includes(ext) || /(spreadsheetml|ms-excel|opendocument.spreadsheet|csv)/.test(mime))
  const isWide = isSpreadsheet || ext === 'pdf' || mime === 'application/pdf'

  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const MIN = 0.25, MAX = 6
  const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z))
  const zoomIn = useCallback(() => setZoom((z) => clamp(+(z + 0.25).toFixed(2))), [])
  const zoomOut = useCallback(() => setZoom((z) => clamp(+(z - 0.25).toFixed(2))), [])
  const reset = useCallback(() => { setZoom(1); setOffset({ x: 0, y: 0 }); setRotate(0) }, [])

  // Keyboard shortcuts for image zoom.
  useEffect(() => {
    if (!isImage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn() }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomOut() }
      else if (e.key === '0') { e.preventDefault(); reset() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isImage, zoomIn, zoomOut, reset])

  const onWheel = (e: ReactWheelEvent) => {
    if (!isImage) return
    setZoom((z) => clamp(+(z - Math.sign(e.deltaY) * 0.15).toFixed(2)))
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!isImage || zoom <= 1) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return
    setOffset({ x: dragRef.current.ox + (e.clientX - dragRef.current.x), y: dragRef.current.oy + (e.clientY - dragRef.current.y) })
  }
  const onPointerUp = () => { dragRef.current = null }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
        <DialogTitle className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.name}</DialogTitle>

        {isImage && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
            <button onClick={zoomOut} disabled={zoom <= MIN} title={tp('zoom_out')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button onClick={reset} title={tp('zoom_reset')} className="min-w-[52px] rounded-md px-1 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-muted">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={zoomIn} disabled={zoom >= MAX} title={tp('zoom_in')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <button onClick={() => setRotate((r) => (r + 90) % 360)} title={tp('rotate')} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        )}

        <Button size="sm" onClick={onDownload} className="gap-1.5">
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">{tp('download')}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClose} title={tp('close') || 'Close'}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview surface */}
      <div
        className="relative flex-1 overflow-hidden bg-muted/20"
        onWheel={onWheel}
      >
        {isImage ? (
          <div
            className="flex h-full w-full items-center justify-center select-none"
            style={{ cursor: zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'default' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onDoubleClick={() => (zoom === 1 ? setZoom(2) : reset())}
          >
            <img
              src={content} alt={item.name} draggable={false}
              className="max-h-full max-w-full object-contain transition-transform duration-100"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotate}deg)` }}
            />
          </div>
        ) : (
          <div className={cn(
            'mx-auto flex h-full w-full overflow-auto p-4',
            isWide ? 'max-w-none' : 'max-w-5xl items-center justify-center',
          )}>
            <FilePreviewBody item={item} tp={tp} />
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
    return <div className="w-full h-full bg-white text-black p-6 overflow-auto rounded-lg shadow-sm" dangerouslySetInnerHTML={{ __html: content }} />
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return <iframe src={content} title={item.name} className="w-full h-full min-h-[70vh] rounded-lg border-0 bg-white" />
  }
  const isSpreadsheet = ['xlsx', 'xls', 'xlsm', 'xlsb', 'csv', 'ods'].includes(ext)
    || /(spreadsheetml|ms-excel|opendocument.spreadsheet|csv)/.test(mime)
  if (isSpreadsheet) {
    return <SpreadsheetPreview item={item} tp={tp} />
  }
  if (['txt'].includes(ext) || mime.startsWith('text/')) {
    let text = ''
    try { text = atob((content.split(',')[1] || '')) } catch { text = '' }
    return <pre className="w-full h-full overflow-auto p-4 text-xs text-foreground whitespace-pre-wrap bg-card rounded-lg">{text}</pre>
  }
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground py-10">
      <FileIcon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{tp('no_preview')}</p>
    </div>
  )
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function SpreadsheetPreview({ item, tp }: { item: Item; tp: (k: string, o?: any) => string }) {
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState(false)

  useEffect(() => {
    setWb(null); setError(false); setActive(0)
    const bytes = dataUrlToUint8Array(item.content || '')
    if (!bytes) { setError(true); return }
    try {
      const parsed = XLSX.read(bytes, { type: 'array' })
      setWb(parsed)
    } catch {
      setError(true)
    }
  }, [item.content, item.id])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-muted-foreground py-10">
        <FileSpreadsheet className="h-10 w-10 opacity-40" />
        <p className="text-sm">{tp('no_preview')}</p>
      </div>
    )
  }
  if (!wb) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const sheetName = wb.SheetNames[active] ?? wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="p-4 text-muted-foreground">{tp('no_preview')}</td></tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'sticky top-0 z-10' : ''}>
                <td className={cn(
                  'sticky start-0 z-10 min-w-[40px] border border-border bg-muted px-2 py-1 text-center font-mono text-[10px] text-muted-foreground',
                  ri === 0 && 'z-20',
                )}>
                  {ri + 1}
                </td>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={cn(
                      'max-w-[320px] truncate border border-border px-2.5 py-1.5',
                      ri === 0 ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-foreground',
                    )}
                    title={String(cell ?? '')}
                  >
                    {String(cell ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {wb.SheetNames.length > 1 && (
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-border bg-muted/40 px-2 py-1.5">
          {wb.SheetNames.map((name, i) => (
            <button
              key={name}
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                i === active ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
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
