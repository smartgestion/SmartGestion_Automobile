import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Printer, FileText,
  ArrowLeft, Check, Loader2, Pencil,
} from 'lucide-react'
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

  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return
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
    return `<!DOCTYPE html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
      <title>${escapeHtml(nameValue)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:40px;color:#111;line-height:1.6;max-width:800px;margin:0 auto}
        h1{font-size:24px} h2{font-size:19px}
        img{max-width:100%}
        ul,ol{padding-inline-start:24px}
      </style></head><body>${body}</body></html>`
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
          <Button variant="outline" size="sm" onClick={printViaIframe} className="gap-1.5">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">{tp('print')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={printViaIframe} className="gap-1.5">
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">{tp('export_pdf')}</span>
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
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={tp('editor_placeholder')}
          className={cn(
            'pf-paper-editor mx-auto max-w-3xl min-h-[60vh] rounded-lg border border-border bg-card p-6 sm:p-8',
            'text-sm leading-relaxed text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15',
            'prose-headings:font-bold [&_h1]:text-2xl [&_h1]:my-3 [&_h2]:text-xl [&_h2]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-6 [&_ol]:ps-6',
          )}
        />
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
