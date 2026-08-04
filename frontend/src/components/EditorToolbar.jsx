import React from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo,
  Redo,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Unlink,
  Download,
  Upload,
  Table,
  Highlighter,
  ChevronDown
} from 'lucide-react';

export const EditorToolbar = ({ editor, disabled = false, onExportMarkdown, onImportMarkdown }) => {
  const [activeMenu, setActiveMenu] = React.useState(null);
  const [showWordCount, setShowWordCount] = React.useState(false);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const getHeadingValue = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    return 'p';
  };

  const handleHeadingChange = (e) => {
    const val = e.target.value;
    if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
    else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
    else editor.chain().focus().setParagraph().run();
  };

  const toggleMenu = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };


  const getTextStats = () => {
    if (!editor) return { words: 0, characters: 0 };
    const text = editor.getText() || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const characters = text.length;
    return { words, characters };
  };

  const handlePrintPDF = () => {
    setActiveMenu(null);
    window.print();
  };

  return (
    <div className="bg-white border-b border-slate-200 relative">
      {/* Outside Click Backdrop for Menu */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-30 bg-transparent"
          onClick={() => setActiveMenu(null)}
        />
      )}

      {/* Google Docs-style Menu Bar */}
      <div className="flex items-center space-x-1 px-2 sm:px-4 py-1 border-b border-slate-100 text-xs text-slate-600 font-medium relative z-40 flex-wrap gap-y-1">
        {/* File Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('file')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'file' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              {onExportMarkdown && (
                <button
                  type="button"
                  onClick={() => { onExportMarkdown(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-medium"
                >
                  <span>Export as Markdown (.md)</span>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
              {onImportMarkdown && (
                <button
                  type="button"
                  onClick={() => { onImportMarkdown(); setActiveMenu(null); }}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-medium"
                >
                  <span>Import Document</span>
                  <Upload className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={handlePrintPDF}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-medium"
              >
                <span>Print / Save as PDF</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+P</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('edit')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'edit' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => { editor?.chain()?.focus()?.undo?.()?.run?.(); setActiveMenu(null); }}
                disabled={!editor?.can?.()?.undo?.()}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 disabled:opacity-40 font-medium"
              >
                <span>Undo</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+Z</span>
              </button>
              <button
                type="button"
                onClick={() => { editor?.chain()?.focus()?.redo?.()?.run?.(); setActiveMenu(null); }}
                disabled={!editor?.can?.()?.redo?.()}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 disabled:opacity-40 font-medium"
              >
                <span>Redo</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+Y</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().selectAll().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-medium"
              >
                <span>Select All</span>
                <span className="text-[10px] text-slate-400 font-mono">Ctrl+A</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetAllMarks().clearNodes().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Clear Formatting</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { if (confirm('Clear all document content?')) editor.chain().focus().clearContent().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-red-600 font-semibold"
              >
                <span>Clear Content</span>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('view')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'view' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => {
                  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
                  else document.exitFullscreen?.();
                  setActiveMenu(null);
                }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Toggle Fullscreen</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowWordCount(true); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Show Word Count</span>
              </button>
            </div>
          )}
        </div>

        {/* Insert Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('insert')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'insert' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Insert
          </button>
          {activeMenu === 'insert' && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => { setLink(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
              >
                <span>Insert Link...</span>
                <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between"
              >
                <span>Insert Table (3x3)</span>
                <Table className="w-3.5 h-3.5 text-slate-400" />
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().toggleBulletList().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Bullet List</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().toggleOrderedList().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Numbered List</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().toggleBlockquote().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Blockquote</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().setHorizontalRule().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Horizontal Line</span>
              </button>
            </div>
          )}
        </div>

        {/* Table Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('table')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'table' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Table
          </button>
          {activeMenu === 'table' && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Insert New Table</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().addColumnBefore().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Add Column Before</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().addColumnAfter().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Add Column After</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().deleteColumn().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Delete Column</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().addRowBefore().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Add Row Before</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().addRowAfter().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Add Row After</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().deleteRow().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Delete Row</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { editor.chain().focus().deleteTable().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-red-600 font-semibold"
              >
                <span>Delete Table</span>
              </button>
            </div>
          )}
        </div>

        {/* Format Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('format')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'format' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Format
          </button>
          {activeMenu === 'format' && (
            <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button type="button" onClick={() => { editor.chain().focus().toggleBold().run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 font-bold text-slate-800">Bold (Ctrl+B)</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleItalic().run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 italic text-slate-800">Italic (Ctrl+I)</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleUnderline().run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 underline text-slate-800">Underline (Ctrl+U)</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleStrike().run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 line-through text-slate-800">Strikethrough</button>
              <div className="my-1 border-t border-slate-100" />
              <button type="button" onClick={() => { editor.chain().focus().setParagraph().run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium">Normal Text</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-800 font-bold text-sm">Heading 1</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-800 font-bold text-xs">Heading 2</button>
              <button type="button" onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-800 font-bold text-xs">Heading 3</button>
              <div className="my-1 border-t border-slate-100" />
              <button type="button" onClick={() => { editor.chain().focus().setTextAlign('left').run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium">Align Left</button>
              <button type="button" onClick={() => { editor.chain().focus().setTextAlign('center').run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium">Align Center</button>
              <button type="button" onClick={() => { editor.chain().focus().setTextAlign('right').run(); setActiveMenu(null); }} className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium">Align Right</button>
            </div>
          )}
        </div>

        {/* Tools Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('tools')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'tools' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Tools
          </button>
          {activeMenu === 'tools' && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => { setShowWordCount(true); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Word count</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowShortcuts(true); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Keyboard shortcuts</span>
              </button>
              <button
                type="button"
                onClick={() => { editor.chain().focus().unsetAllMarks().clearNodes().run(); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>Clear formatting</span>
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('help')}
            className={`px-2 py-0.5 rounded hover:bg-slate-100 transition ${activeMenu === 'help' ? 'bg-slate-100 text-slate-900 font-semibold' : ''}`}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-scaleIn">
              <button
                type="button"
                onClick={() => { setShowHelp(true); setActiveMenu(null); }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
              >
                <span>SyncWrite Editor Guide</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Word Count Modal */}
      {showWordCount && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowWordCount(false)}>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-sm w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-4">Word Count</h3>
            <div className="space-y-3 text-sm text-slate-600 mb-6">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Words:</span>
                <span className="font-semibold text-slate-900">{getTextStats().words}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span>Characters:</span>
                <span className="font-semibold text-slate-900">{getTextStats().characters}</span>
              </div>
            </div>
            <button
              onClick={() => setShowWordCount(false)}
              className="w-full py-2 bg-brand-600 text-white font-semibold text-sm rounded-lg hover:bg-brand-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-md w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-xs text-slate-600 mb-6">
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Bold</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + B</kbd></div>
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Italic</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + I</kbd></div>
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Underline</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + U</kbd></div>
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Undo</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + Z</kbd></div>
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Redo</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + Y</kbd></div>
              <div className="flex justify-between py-1 border-b border-slate-100"><span>Select All</span><kbd className="px-2 py-0.5 bg-slate-100 rounded font-mono">Ctrl + A</kbd></div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full py-2 bg-brand-600 text-white font-semibold text-sm rounded-lg hover:bg-brand-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl max-w-md w-full animate-scaleIn" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold font-heading text-slate-900 mb-2">SyncWrite Editor Help</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-5">
              SyncWrite allows real-time collaborative editing with automatic background saving. Changes are synchronized live across all active collaborators.
            </p>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2 bg-brand-600 text-white font-semibold text-sm rounded-lg hover:bg-brand-700 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}


      {/* Primary Formatting Toolbar */}
      <div className={`flex items-center justify-between gap-1 px-2 sm:px-4 py-1.5 bg-slate-50/70 overflow-x-auto no-scrollbar transition ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-0.5 min-w-max">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={() => editor?.chain()?.focus()?.undo?.()?.run?.()}
            disabled={!editor?.can?.()?.undo?.()}
            className="p-1.5 rounded hover:bg-slate-200/70 disabled:opacity-30 transition text-slate-700"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor?.chain()?.focus()?.redo?.()?.run?.()}
            disabled={!editor?.can?.()?.redo?.()}
            className="p-1.5 rounded hover:bg-slate-200/70 disabled:opacity-30 transition text-slate-700"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1.5" />

          {/* Heading Dropdown */}
          <select
            value={getHeadingValue()}
            onChange={handleHeadingChange}
            className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer text-slate-700"
          >
            <option value="p">Normal text</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <div className="h-4 w-px bg-slate-300 mx-1.5" />

          {/* Text Formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('bold') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('italic') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('underline') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('strike') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1.5" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('bulletList') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('orderedList') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('blockquote') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Blockquote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1.5" />

          {/* Text Alignment */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1.5" />


          {/* Link */}
          <button
            type="button"
            onClick={setLink}
            className={`p-1.5 rounded hover:bg-slate-200/70 transition ${editor.isActive('link') ? 'bg-slate-200/80 text-brand-600 font-bold' : 'text-slate-700'}`}
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 rounded hover:bg-slate-200/70 text-red-600"
              title="Unlink"
            >
              <Unlink className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Import/Export */}
        <div className="flex items-center space-x-1">
          {onExportMarkdown && (
            <button
              type="button"
              onClick={onExportMarkdown}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded transition flex items-center space-x-1"
              title="Export HTML/Markdown"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {onImportMarkdown && (
            <button
              type="button"
              onClick={onImportMarkdown}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded transition flex items-center space-x-1"
              title="Import File"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
