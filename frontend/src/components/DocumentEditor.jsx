import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { EditorToolbar } from './EditorToolbar';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export const DocumentEditor = ({
  documentId,
  initialStateData,
  userRole,
  onSaveStatusChange,
  onPresenceChange,
  onTypingChange
}) => {
  const { user, accessToken } = useAuth();
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isRemoteUpdateRef = useRef(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isEditingAllowed = ['OWNER', 'EDITOR'].includes(userRole);
  const isEditingAllowedRef = useRef(isEditingAllowed);

  useEffect(() => {
    isEditingAllowedRef.current = isEditingAllowed;
  }, [isEditingAllowed]);

  const editor = useEditor({
    editable: isEditingAllowed,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],

    content: initialStateData || '',

    onSelectionUpdate: ({ editor }) => {
      if (socketRef.current && userRef.current) {
        const selection = editor.state.selection;
        socketRef.current.emit('cursor:update', {
          document_id: documentId,
          cursor: { from: selection.from, to: selection.to }
        });
      }
    },
    onUpdate: ({ editor }) => {
      if (!isEditingAllowedRef.current) return;

      if (isRemoteUpdateRef.current) {
        isRemoteUpdateRef.current = false;
        return;
      }

      onSaveStatusChange('saving');

      if (socketRef.current) {
        socketRef.current.emit('typing:start', { document_id: documentId });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (socketRef.current) {
            socketRef.current.emit('typing:stop', { document_id: documentId });
          }
        }, 1500);

        const html = editor.getHTML();
        socketRef.current.emit('document:update', {
          token: accessToken || sessionStorage.getItem('access_token'),
          document_id: documentId,
          update_data: html,
          full_state: html
        });
      }

      setTimeout(() => {
        onSaveStatusChange('saved');
      }, 800);
    }
  });

  // Dynamically update Tiptap's editable property when userRole changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditingAllowed);
    }
  }, [editor, isEditingAllowed]);

  useEffect(() => {
    if (editor && initialStateData !== undefined && initialStateData !== null) {
      const currentContent = editor.getHTML();
      if (currentContent !== initialStateData) {
        isRemoteUpdateRef.current = true;
        editor.commands.setContent(initialStateData, false);
        isRemoteUpdateRef.current = false;
      }
    }
  }, [editor, initialStateData]);

  useEffect(() => {
    if (!editor || !documentId) return;

    const socket = getSocket(accessToken);
    socketRef.current = socket;

    const joinDocRoom = () => {
      const token = accessToken || sessionStorage.getItem('access_token');
      if (token && documentId) {
        socket.emit('document:join', {
          token,
          document_id: documentId
        });
      }
    };

    joinDocRoom();
    socket.on('connect', joinDocRoom);

    const handleSync = (data) => {
      if (data && data.state_data !== undefined && data.state_data !== null && editor) {
        const targetContent = data.state_data;
        if (editor.getHTML() !== targetContent) {
          isRemoteUpdateRef.current = true;
          editor.commands.setContent(targetContent || '', false);
          isRemoteUpdateRef.current = false;
        }
      }
      onSaveStatusChange('saved');
    };

    const handleUpdate = (data) => {
      if (!data || !data.update_data || !editor) return;

      const currentUserId = String(userRef.current?.id || userRef.current?.user_id || '');
      const senderUserId = String(data.user_id || '');

      // Skip echo if the update originated from ourselves
      if (currentUserId && senderUserId && currentUserId === senderUserId) {
        return;
      }

      const currentContent = editor.getHTML();
      const incomingContent = data.update_data;

      if (currentContent !== incomingContent) {
        isRemoteUpdateRef.current = true;
        const { from, to } = editor.state.selection;
        editor.commands.setContent(incomingContent, false);
        isRemoteUpdateRef.current = false;
        try {
          const docLength = editor.state.doc.content.size;
          if (from <= docLength && to <= docLength) {
            editor.commands.setTextSelection({ from, to });
          }
        } catch (e) {
          // Ignore selection error if structure changed
        }
      }
    };

    const handlePresenceUpdate = (data) => {
      if (onPresenceChange) {
        onPresenceChange(data.active_users || []);
      }
    };

    const handleTypingStatus = (data) => {
      if (onTypingChange) {
        onTypingChange(data);
      }
    };

    socket.on('document:sync', handleSync);
    socket.on('document:update', handleUpdate);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('typing:status', handleTypingStatus);

    return () => {
      socket.off('connect', joinDocRoom);
      socket.off('document:sync', handleSync);
      socket.off('document:update', handleUpdate);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('typing:status', handleTypingStatus);
      socket.emit('document:leave', { document_id: documentId });
    };
  }, [editor, documentId]);

  const convertHtmlToMarkdown = (html) => {
    if (!html) return '';
    let md = html;

    // Convert Headings
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

    // Bold, Italic, Underline, Strikethrough
    md = md.replace(/<(strong|b)[^>]*>(.*?)<\/\1>/gi, '**$2**');
    md = md.replace(/<(em|i)[^>]*>(.*?)<\/\1>/gi, '*$2*');
    md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
    md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');

    // Lists
    md = md.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, p1) => {
      return p1.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
    });
    md = md.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, p1) => {
      let index = 1;
      return p1.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
    });

    // Paragraphs & Line Breaks
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    md = md.replace(/<br\s*\/?>/gi, '\n');

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n\n');

    // Strip remaining HTML tags
    md = md.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    const txt = document.createElement('textarea');
    txt.innerHTML = md;
    return txt.value.trim();
  };

  const handleExportMarkdown = () => {
    if (!editor) return;
    const htmlContent = editor.getHTML();
    const markdownContent = convertHtmlToMarkdown(htmlContent);
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document_${documentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportMarkdown = () => {
    if (!isEditingAllowed || !editor) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.txt,.md';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        isRemoteUpdateRef.current = false;
        editor.commands.setContent(text);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      <EditorToolbar
        editor={editor}
        disabled={!isEditingAllowed}
        onExportMarkdown={handleExportMarkdown}
        onImportMarkdown={handleImportMarkdown}
      />
      <div
        className="flex-1 overflow-y-auto p-2 sm:p-6 lg:p-8 flex justify-center bg-slate-100/50 dark:bg-slate-950 cursor-text"
        onClick={() => editor && editor.focus()}
      >
        <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[600px] flex flex-col">
          <EditorContent editor={editor} className="flex-1 font-sans dark:text-slate-100" />
        </div>
      </div>
    </div>
  );
};
