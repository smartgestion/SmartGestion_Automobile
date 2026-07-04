import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Printer, FileText,
  ArrowLeft, Check, Loader2, Pencil, Save, FileType,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PaperEditorProps {
  name: string
  initialHtml: string
  /** Persist the paper. Returns a promise so we can show a saving indicator. */
  onSave: (html: string) => Promise<void>
  onRename: (name: string) => Promise<void>
  onBack: () => void
}

type SaveState = 'idle' | 'saving' | 'saved'

export function PaperEditor({ name, initialHtml, onSave, onRename, onBack }: PaperEditorProps) {
  const { t, i18n } = useTranslation()
  const isRTL = i18n.language?.startsWith('ar')
  const tp = (k: string) => t(`portefeuille.${k}`)

  const editorRef = useRef<HTMLDivElement>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestHtml = useRef(initialHtml)

  // Initialise the editor content once.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml || ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => setNameValue(name), [name])

  const doSave = useCallback(async (force = false) => {
    if (!force && !dirtyRef.current) return
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    dirtyRef.current = false
    setSaveState('saving')
    try {
      await onSave(latestHtml.current)
      setSaveState('saved')
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800)
    } catch {
      setSaveState('idle')
    }
  }, [onSave])

  // Manual save: always capture latest content and persist.
  const handleManualSave = useCallback(() => {
    latestHtml.current = editorRef.current?.innerHTML ?? latestHtml.current
    doSave(true)
  }, [doSave])

  // Debounced auto-save on every input.
  const handleInput = () => {
    latestHtml.current = editorRef.current?.innerHTML ?? ''
    dirtyRef.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(doSave, 1000)
  }

  // Flush pending save on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (dirtyRef.current) onSave(latestHtml.current).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Ctrl/Cmd+S to save manually.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleManualSave])

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    handleInput()
  }

  const commitName = async () => {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== name) await onRename(trimmed)
    else setNameValue(name)
  }

  const buildPrintHtml = () => {
    const body = editorRef.current?.innerHTML ?? latestHtml.current
    const docTitle = (nameValue || tp('untitled_paper')).trim()
    const titleHeading = docTitle
      ? `<h1 class="pf-doc-title">${escapeHtml(docTitle)}</h1>`
      : ''
    return `<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${escapeHtml(docTitle)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#111;line-height:1.6;max-width:800px;margin:0 auto}
        h1{font-size:24px} h2{font-size:19px}
        .pf-doc-title{font-size:28px;font-weight:700;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
        img{max-width:100%}
        ul,ol{padding-inline-start:24px}
      </style></head><body>${titleHeading}${body}</body></html>`
  }

  // Build a Word-compatible HTML document (Word opens HTML-based .doc files).
  const buildWordHtml = () => {
    const body = editorRef.current?.innerHTML ?? latestHtml.current
    const docTitle = (nameValue || tp('untitled_paper')).trim()
    const titleHeading = docTitle
      ? `<h1 class="pf-doc-title">${escapeHtml(docTitle)}</h1>`
      : ''
    return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${escapeHtml(docTitle)}</title>
      <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
      <style>
        body{font-family:'Calibri',Arial,Helvetica,sans-serif;color:#111;line-height:1.6}
        h1{font-size:24px} h2{font-size:19px}
        .pf-doc-title{font-size:28px;font-weight:700;margin:0 0 20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
        img{max-width:100%}
        ul,ol{padding-inline-start:24px}
      </style></head><body>${titleHeading}${body}</body></html>`
  }

  const downloadWord = () => {
    latestHtml.current = editorRef.current?.innerHTML ?? latestHtml.current
    const docTitle = (nameValue || tp('untitled_paper')).trim() || 'document'
    const html = buildWordHtml()
    // 'application/msword' with a .doc extension: opens natively in Microsoft Word.
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${docTitle.replace(/[\\/:*?"<>|]+/g, '_')}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success(tp('toast.word_downloaded'))
  }

  const printViaIframe = () => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'; iframe.style.height = '0'; iframe.style.border = '0'
    iframe.style.right = '0'; iframe.style.bottom = '0'
    document.body.appendChild(iframe)
    const cw = iframe.contentWindow
    if (!cw) { document.body.removeChild(iframe); return }
    cw.document.open(); cw.document.write(buildPrintHtml()); cw.document.close()
    setTimeout(() => {
      cw.focus(); cw.print()
      setTimeout(() => { try { document.body.removeChild(iframe) } catch { /* noop */ } }, 1000)
    }, 250)
  }

  const ToolbarBtn = ({
    onClick, title, children, active,
  }: { onClick: () => void; title: string; children: ReactNode; active?: boolean }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        active && 'bg-muted text-foreground',
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        {editingName ? (
          <Input
            autoFocus
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameValue(name); setEditingName(false) } }}
            className="h-9 max-w-xs font-semibold"
          />
        ) : (
          <button
            className="group flex items-center gap-2 text-base font-bold text-foreground hover:text-primary transition-colors"
            onClick={() => setEditingName(true)}
          >
            {nameValue || tp('untitled_paper')}
            <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60" />
          </button>
        )}

        <div className="ms-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-[90px] justify-end">
            {saveState === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin" />{tp('saving')}</>)}
            {saveState === 'saved' && (<><Check className="h-3 w-3 text-emerald-500" />{tp('auto_saved')}</>)}
          </span>
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={saveState === 'saving'}
            className="gap-1.5 bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            title="Ctrl+S"
          >
            {saveState === 'saving'
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">{tp('save')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={printViaIframe} className="gap-1.5">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">{tp('print')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={printViaIframe} className="gap-1.5">
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">{tp('export_pdf')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={downloadWord} className="gap-1.5">
            <FileType className="h-4 w-4" /> <span className="hidden sm:inline">{tp('export_word')}</span>
          </Button>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap py-2 border-b border-border">
        <ToolbarBtn onClick={() => exec('bold')} title="Bold"><Bold className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('italic')} title="Italic"><Italic className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('underline')} title="Underline"><Underline className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn onClick={() => exec('formatBlock', 'H1')} title="Heading 1"><Heading1 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('formatBlock', 'H2')} title="Heading 2"><Heading2 className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyRight')} title="Align right"><AlignRight className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarBtn onClick={() => exec('undo')} title="Undo"><Undo className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('redo')} title="Redo"><Redo className="h-4 w-4" /></ToolbarBtn>
      </div>

      {/* Editable surface */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="mx-auto max-w-3xl min-h-[60vh] rounded-lg border border-border bg-card p-6 sm:p-8">
          {/* Document title heading */}
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground mb-4 pb-3 border-b border-border break-words"
            title={tp('untitled_paper')}
          >
            {nameValue || tp('untitled_paper')}
          </h1>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            data-placeholder={tp('editor_placeholder')}
            className={cn(
              'pf-paper-editor outline-none',
              'text-sm leading-relaxed text-foreground focus:outline-none',
              'prose-headings:font-bold [&_h1]:text-2xl [&_h1]:my-3 [&_h2]:text-xl [&_h2]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6',
            )}
          />
        </div>
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
