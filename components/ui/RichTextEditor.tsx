'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Heading2,
    Link as LinkIcon,
    Unlink
} from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('URL', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    return (
        <div className="flex flex-wrap gap-1 p-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Bold"
            >
                <Bold size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Italic"
            >
                <Italic size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Heading"
            >
                <Heading2 size={18} />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Bullet List"
            >
                <List size={18} />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Ordered List"
            >
                <ListOrdered size={18} />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
            <button
                type="button"
                onClick={setLink}
                className={`p-1.5 rounded-lg transition-colors ${editor.isActive('link') ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
                title="Set Link"
            >
                <LinkIcon size={18} />
            </button>
            {editor.isActive('link') && (
                <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-100 text-red-600 dark:hover:bg-red-900/30 dark:text-red-400"
                    title="Unlink"
                >
                    <Unlink size={18} />
                </button>
            )}
        </div>
    );
};

export default function RichTextEditor({ value, onChange, placeholder = 'Type something...' }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary-500 underline decoration-primary-500/30 underline-offset-4 hover:decoration-primary-500 transition-all',
                },
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-4 py-3 text-gray-900 dark:text-white',
            },
            handlePaste: () => {
                return false; // Let default paste handle it
            }
        },
        immediatelyRender: false, // Recommended for Next.js SSR
    });

    // Content sync logic: Update editor if value prop changes and differs from current content
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    return (
        <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus-within:ring-2 focus-within:ring-primary-500 transition-all overflow-hidden">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
            <style jsx global>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 1rem 0 !important;
        }
        .ProseMirror ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin: 1rem 0 !important;
        }
        .ProseMirror a {
          color: #0ea5e9;
          text-decoration: underline;
          cursor: pointer;
        }
        .dark .ProseMirror a {
          color: #38bdf8;
        }
      `}</style>
        </div>
    );
}
