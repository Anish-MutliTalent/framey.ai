import { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Layout } from '../../components/erp/Layout';
import { useApi } from '../../hooks/useApi';
import { T } from '../../theme';
import { Plus, Trash2, FileText, Type, Pencil, RefreshCw } from 'lucide-react';

interface NoteData {
  id: number; title: string; content: string;
  canvas_data?: string; created_at: string; updated_at: string;
}

const COLORS = [T.text, '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

const modules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'], ['clean'],
  ],
};

export function StudentNotes() {
  const { request } = useApi();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [selected, setSelected] = useState<NoteData | null>(null);
  const [canvasMode, setCanvasMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(T.text);
  const [strokeW, setStrokeW] = useState(2);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    request<NoteData[]>('/notes').then(n => {
      setNotes(n);
      if (n.length > 0) setSelected(n[0]);
    }).catch(console.error).finally(() => setLoading(false));
  }, [request]);

  // Determine locked mode
  const hasText = (n: NoteData | null) => !!n?.content?.replace(/<[^>]*>/gm, '').trim();
  const hasCanvas = (n: NoteData | null) => (n?.canvas_data?.length ?? 0) > 50;
  const textLocked = hasText(selected) && !hasCanvas(selected);
  const canvasLocked = hasCanvas(selected) && !hasText(selected);

  useEffect(() => {
    if (!selected) return;
    if (hasCanvas(selected)) setCanvasMode(true);
    else if (hasText(selected)) setCanvasMode(false);
  }, [selected?.id]);

  // Load canvas data
  useEffect(() => {
    if (!canvasMode || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (selected?.canvas_data) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = selected.canvas_data;
    }
  }, [canvasMode, selected?.id]);

  const debounce = (id: number, field: string, value: string) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      request(`/notes/${id}`, { method: 'PUT', body: { [field]: value } }).catch(console.error);
      setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
    }, 800);
  };

  const createNote = async () => {
    const n = await request<NoteData>('/notes', { method: 'POST', body: { title: 'Untitled Note', content: '' } });
    setNotes(prev => [n, ...prev]);
    setSelected(n);
    setCanvasMode(false);
  };

  const deleteNote = async (id: number) => {
    if (!confirm('Delete this note?')) return;
    await request(`/notes/${id}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) setSelected(notes.find(n => n.id !== id) ?? null);
  };

  // Canvas drawing
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    setDrawing(true);
    const r = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext('2d')!;
    const r = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const stopDraw = () => {
    if (!drawing || !selected) return;
    setDrawing(false);
    const data = canvasRef.current!.toDataURL();
    setSelected(prev => prev ? { ...prev, canvas_data: data } : null);
    debounce(selected.id, 'canvas_data', data);
  };

  return (
    <Layout title="Notes">
      <div className="flex" style={{ height: 'calc(100vh - 120px)', gap: '1px' }}>
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${T.border}` }}>
            <span className="text-xs font-semibold" style={{ color: T.text }}>Notes</span>
            <button onClick={createNote} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
              style={{ color: T.accent }}><Plus size={15} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && <div className="text-center py-8 text-xs" style={{ color: T.textMuted }}>Loading…</div>}
            {notes.map(n => (
              <div key={n.id} onClick={() => setSelected(n)}
                className="group flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: selected?.id === n.id ? T.bgDeep : 'transparent',
                  border: `1px solid ${selected?.id === n.id ? T.border : 'transparent'}`,
                }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: T.text }}>{n.title || 'Untitled'}</div>
                  <div className="text-xs truncate mt-0.5" style={{ color: T.textMuted }}>
                    {hasCanvas(n) ? 'Handwritten' : n.content.replace(/<[^>]*>/gm, '').slice(0, 30) || 'Empty'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 transition-opacity"
                  style={{ color: T.danger }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden ml-3"
          style={{ background: T.card, border: `1px solid ${T.border}` }}>
          {selected ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center gap-3 px-5 py-2.5 shrink-0"
                style={{ borderBottom: `1px solid ${T.border}` }}>
                {/* Mode switcher */}
                <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: T.bgDeep }}>
                  {!canvasLocked && (
                    <button onClick={() => setCanvasMode(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={!canvasMode
                        ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                        : { color: T.textMuted }}>
                      <Type size={13} /> Text
                    </button>
                  )}
                  {!textLocked && (
                    <button onClick={() => setCanvasMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                      style={canvasMode
                        ? { background: T.card, color: T.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                        : { color: T.textMuted }}>
                      <Pencil size={13} /> Draw
                    </button>
                  )}
                </div>

                {/* Canvas toolbar */}
                {canvasMode && (
                  <div className="flex items-center gap-1.5">
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setColor(c)}
                        className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, outline: color === c ? `2px solid ${T.text}` : 'none', outlineOffset: '2px' }} />
                    ))}
                    <div className="w-px h-4 mx-1" style={{ background: T.border }} />
                    <button onClick={() => setStrokeW(2)}
                      className="p-1.5 rounded"
                      style={{ background: strokeW === 2 ? T.bgDeep : 'transparent' }}>
                      <div className="w-3 h-0.5 rounded-full" style={{ background: T.text }} />
                    </button>
                    <button onClick={() => setStrokeW(5)}
                      className="p-1.5 rounded"
                      style={{ background: strokeW === 5 ? T.bgDeep : 'transparent' }}>
                      <div className="w-3 h-1.5 rounded-full" style={{ background: T.text }} />
                    </button>
                    <button onClick={() => {
                      if (confirm('Clear drawing?')) {
                        request(`/notes/${selected.id}`, { method: 'PUT', body: { canvas_data: '' } });
                        setSelected(p => p ? { ...p, canvas_data: '' } : null);
                        const ctx = canvasRef.current?.getContext('2d');
                        if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                      }
                    }} className="p-1.5 rounded hover:opacity-70" style={{ color: T.danger }}>
                      <RefreshCw size={13} />
                    </button>
                  </div>
                )}

                {/* Title */}
                <input type="text" value={selected.title}
                  onChange={e => { const v = e.target.value; setSelected(p => p ? { ...p, title: v } : null); debounce(selected.id, 'title', v); }}
                  className="ml-auto text-right text-sm font-medium bg-transparent outline-none border-b border-transparent focus:border-stone-300"
                  style={{ color: T.text, minWidth: '120px' }}
                  placeholder="Note title" />
              </div>

              {/* Surface */}
              <div className="flex-1 overflow-hidden">
                {canvasMode ? (
                  <div className="w-full h-full p-4 overflow-auto" style={{ background: T.bg }}>
                    <canvas ref={canvasRef} width={1200} height={900}
                      className="rounded-xl cursor-crosshair touch-none"
                      style={{ background: '#fff', maxWidth: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} />
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto notes-quill-light">
                    <ReactQuill theme="snow" value={selected.content}
                      onChange={v => { setSelected(p => p ? { ...p, content: v } : null); debounce(selected.id, 'content', v); }}
                      modules={modules} className="h-full" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: T.textMuted }}>
              <FileText size={32} strokeWidth={1.5} />
              <p className="text-xs">Select a note or create one</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .notes-quill-light .ql-container { border: none; font-size: 0.9rem; font-family: inherit; }
        .notes-quill-light .ql-toolbar { border: none; border-bottom: 1px solid ${T.border}; padding: 8px 20px; background: ${T.bgDeep}; }
        .notes-quill-light .ql-editor { padding: 20px 24px; min-height: 100%; color: ${T.text}; }
        .notes-quill-light .ql-editor.ql-blank::before { color: ${T.textMuted}; font-style: normal; }
      `}</style>
    </Layout>
  );
}
