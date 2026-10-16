'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiRequest } from '../../../lib/api';

interface Slide {
  id: string;
  presentationId: string;
  orderIndex: number;
  type: 'CONTENT' | 'POLL' | 'QA';
  title: string;
  subtitle?: string;
  content?: string;
  design?: string;
  options?: string; // JSON string e.g. ["Option A", "Option B"]
  votes?: any[];
}

interface Presentation {
  id: string;
  title: string;
  accessCode: string;
  isPublished: boolean;
}

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const presentationId = resolvedParams.id;

  const { user, token, isLoading } = useAuth();
  const router = useRouter();

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<boolean>(false);
  const saveVersion = useRef(0);

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
      return;
    }

    if (token) {
      loadData();
    }
  }, [token, isLoading, presentationId, router]);

  useEffect(() => {
    const handleEditorKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveSlideIndex((index) => Math.min(index + 1, slides.length - 1));
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveSlideIndex((index) => Math.max(index - 1, 0));
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        void handleDuplicateSlide();
      }
    };

    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, [slides.length, activeSlideIndex]);

  const loadData = async () => {
    setIsFetching(true);
    try {
      const presRes = await apiRequest(`/presentations/${presentationId}`);
      setPresentation(presRes.presentation);

      const slidesRes = await apiRequest(`/slides/presentation/${presentationId}`);
      setSlides(slidesRes.slides || []);
    } catch (err) {
      console.error('Failed to load editor data:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const activeSlide = slides[activeSlideIndex] || null;
  const templates = [
    { name: 'Minimal', background: '#ffffff', foreground: '#151923', layout: 'classic' },
    { name: 'Midnight', background: '#10182b', foreground: '#f7fafc', layout: 'classic' },
    { name: 'Ocean', background: '#073b4c', foreground: '#ffffff', layout: 'split' },
    { name: 'Sunset', background: '#542344', foreground: '#fff5eb', layout: 'center' },
  ];
  const design = (() => { try { return JSON.parse(activeSlide?.design || '{}'); } catch { return {}; } })();
  const setDesign = (change: Record<string, string>) => updateActiveSlide({ design: JSON.stringify({ ...design, ...change }) });
  const [draggedSlide, setDraggedSlide] = useState<string | null>(null);
  const reorderSlide = async (targetId: string) => {
    if (!draggedSlide || draggedSlide === targetId) return;
    const oldSlides = [...slides];
    const ordered = [...slides];
    const from = ordered.findIndex(s => s.id === draggedSlide);
    const to = ordered.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    setSlides(ordered);
    setActiveSlideIndex(ordered.findIndex(s => s.id === activeSlide?.id));
    setDraggedSlide(null);
    try {
      await Promise.all(ordered.map((slide, index) => apiRequest(`/slides/${slide.id}`, { method: 'PUT', body: JSON.stringify({ orderIndex: index }) })));
    } catch {
      setSlides(oldSlides);
      setSaveError(true);
    }
  };

  const renamePresentation = async () => {
    if (!presentation) return;
    const title = window.prompt('Neuer Präsentationstitel', presentation.title);
    if (!title || !title.trim()) return;
    try {
      const response = await apiRequest(`/presentations/${presentationId}`, {
        method: 'PATCH', body: JSON.stringify({ title: title.trim() }),
      });
      setPresentation(response.presentation);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen'); }
  };

  const togglePublication = async () => {
    if (!presentation) return;
    try {
      const response = await apiRequest(`/presentations/${presentationId}`, {
        method: 'PATCH', body: JSON.stringify({ isPublished: !presentation.isPublished }),
      });
      setPresentation(response.presentation);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Statusänderung fehlgeschlagen'); }
  };

  const updateActiveSlide = async (updates: Partial<Slide>) => {
    if (!activeSlide) return;

    const requestVersion = saveVersion.current + 1;
    saveVersion.current = requestVersion;
    const previousSlide = activeSlide;

    const updatedSlides = [...slides];
    const newSlideData = { ...activeSlide, ...updates };
    updatedSlides[activeSlideIndex] = newSlideData;
    setSlides(updatedSlides);

    setIsSaving(true);
    setSaveError(false);
    try {
      await apiRequest(`/slides/${activeSlide.id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (saveVersion.current === requestVersion) {
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Failed to update slide:', err);
      if (saveVersion.current === requestVersion) {
        setSlides((currentSlides) => {
          const revertedSlides = [...currentSlides];
          revertedSlides[activeSlideIndex] = previousSlide;
          return revertedSlides;
        });
        setIsSaving(false);
        setSaveError(true);
      }
    } finally {
      if (saveVersion.current === requestVersion) {
        setIsSaving(false);
      }
    }
  };

  const handleAddSlide = async () => {
    try {
      const res = await apiRequest(`/slides/presentation/${presentationId}`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Folie ${slides.length + 1}`,
          type: 'CONTENT',
          content: 'Neuer Inhalt hier...',
        }),
      });

      const newSlides = [...slides, res.slide];
      setSlides(newSlides);
      setActiveSlideIndex(newSlides.length - 1);
    } catch (err) {
      console.error('Failed to create slide:', err);
    }
  };

  const handleDuplicateSlide = async () => {
    if (!activeSlide) return;

    try {
      const res = await apiRequest(`/slides/presentation/${presentationId}`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${activeSlide.title || 'Folie'} (Kopie)`,
          type: activeSlide.type,
          subtitle: activeSlide.subtitle,
          content: activeSlide.content,
          options: activeSlide.options,
          design: activeSlide.design,
        }),
      });

      const newSlides = [...slides, res.slide];
      setSlides(newSlides);
      setActiveSlideIndex(newSlides.length - 1);
    } catch (err) {
      console.error('Failed to duplicate slide:', err);
    }
  };

  const handleDeleteSlide = async (slideId: string, index: number) => {
    if (slides.length <= 1) {
      alert('Eine Präsentation muss mindestens eine Folie enthalten.');
      return;
    }

    try {
      await apiRequest(`/slides/${slideId}`, { method: 'DELETE' });
      const newSlides = slides.filter((s) => s.id !== slideId);
      setSlides(newSlides);
      setActiveSlideIndex(Math.max(0, index - 1));
    } catch (err) {
      console.error('Failed to delete slide:', err);
    }
  };

  // Poll options parser helpers
  const parsePollOptions = (optionsStr?: string): string[] => {
    if (!optionsStr) return ['Option A', 'Option B'];
    try {
      return JSON.parse(optionsStr);
    } catch {
      return ['Option A', 'Option B'];
    }
  };

  const handlePollOptionChange = (optionIdx: number, value: string) => {
    const currentOptions = parsePollOptions(activeSlide?.options);
    currentOptions[optionIdx] = value;
    updateActiveSlide({ options: JSON.stringify(currentOptions) });
  };

  const handleAddPollOption = () => {
    const currentOptions = parsePollOptions(activeSlide?.options);
    currentOptions.push(`Option ${String.fromCharCode(65 + currentOptions.length)}`);
    updateActiveSlide({ options: JSON.stringify(currentOptions) });
  };

  const handleRemovePollOption = (optionIdx: number) => {
    const currentOptions = parsePollOptions(activeSlide?.options);
    if (currentOptions.length <= 2) {
      alert('Eine Umfrage muss mindestens 2 Optionen haben.');
      return;
    }
    currentOptions.splice(optionIdx, 1);
    updateActiveSlide({ options: JSON.stringify(currentOptions) });
  };

  if (isLoading || isFetching) {
    return (
      <div className="loadingState" style={{ height: '100vh' }}>
        <div className="spinner" />
        <p>Lade Präsentations-Editor...</p>
      </div>
    );
  }

  if (!presentation) {
    return (
      <div className="loadingState" style={{ height: '100vh' }}>
        <h2>Präsentation nicht gefunden</h2>
        <Link href="/dashboard" className="buttonPrimary">Zurück zum Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="editorLayout">
      {/* Topbar */}
      <header className="editorTopbar">
        <div className="topbarLeft">
          <Link href="/dashboard" className="brand">
            <span className="brandMark">Z</span>
            <span>Zeivio</span>
          </Link>
          <span className="divider">/</span>
          <button type="button" className="presentationTitleText" onClick={renamePresentation} title="Präsentation umbenennen">{presentation.title} ✎</button>
          {isSaving && <span className="savingBadge">Speichert...</span>}
          {!isSaving && saveError && <span className="savingBadge saveErrorBadge">Nicht gespeichert</span>}
          {!isSaving && !saveError && <span className="savingBadge savedBadge">Gespeichert</span>}
        </div>

        <div className="topbarCenter">
          <div className="joinCodePill">
            <span>Code zum Beitreten:</span>
            <code>zeiv.io/{presentation.accessCode}</code>
          </div>
        </div>

        <div className="topbarRight">
          <button type="button" className="buttonSecondary" onClick={togglePublication}>{presentation.isPublished ? "Freigabe deaktivieren" : "Veröffentlichen"}</button>
          <Link href={`/present/${presentationId}`} className="buttonPrimary presentNavButton">
            Präsentieren ▶
          </Link>
        </div>
      </header>

      <div className="editorMain">
        {/* Left Sidebar: Slides List */}
        <aside className="editorSidebar">
          <div className="sidebarHeader">
            <span>Folien ({slides.length})</span>
          </div>

          <div className="slidesList">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => setDraggedSlide(slide.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); void reorderSlide(slide.id); }}
                onDragEnd={() => setDraggedSlide(null)}
                className={`slideThumbItem ${idx === activeSlideIndex ? 'active' : ''}`}
                onClick={() => setActiveSlideIndex(idx)}
              >
                <span className="thumbNumber">{idx + 1}</span>
                <div className="thumbPreview">
                  <div className="thumbTitle">{slide.title || 'Unbenannte Folie'}</div>
                  <span className="thumbTypeBadge">{slide.type}</span>
                </div>
                {slides.length > 1 && (
                  <button
                    className="thumbDeleteButton"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlide(slide.id, idx);
                    }}
                    title="Folie löschen"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button className="addSlideButton" onClick={handleAddSlide}>
            + Neue Folie
          </button>
          <button
            className="duplicateSlideButton"
            onClick={handleDuplicateSlide}
            disabled={!activeSlide}
            title="Aktive Folie als Vorlage duplizieren"
          >
            Folie duplizieren
          </button>
        </aside>

        {/* Center: Live Canvas Preview */}
        <main className="editorCanvasArea">
          {activeSlide && (
            <div className="canvasSlideBox" style={{ background: design.background || "#ffffff", color: design.foreground || "#151923" }}>
              <div className="canvasSlideHeader">
                <span className="canvasTypeBadge">{activeSlide.type}</span>
                <span className="canvasCodeBadge">zeiv.io/{presentation.accessCode}</span>
              </div>

              <div className="canvasBody" style={{ textAlign: design.layout === "center" ? "center" : "left", display: design.layout === "split" ? "grid" : "block", gridTemplateColumns: design.layout === "split" ? "1fr 1fr" : undefined, gap: 24 }}>
                <h1 className="canvasTitle">{activeSlide.title || 'Foliensuchzeile'}</h1>
                {activeSlide.subtitle && <h3 className="canvasSubtitle">{activeSlide.subtitle}</h3>}

                {design.imageUrl && <img src={design.imageUrl} alt="Folienbild" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 12 }} />}
                {activeSlide.type === 'CONTENT' && (
                  <div className="canvasContentText">
                    {activeSlide.content || 'Hier erscheint der Folieninhalt...'}
                  </div>
                )}

                {activeSlide.type === 'POLL' && (
                  <div className="canvasPollDemo">
                    <span className="pollQuestionLabel">Umfrageoptionen für das Publikum:</span>
                    <div className="pollOptionsList">
                      {parsePollOptions(activeSlide.options).map((opt, i) => (
                        <div key={i} className="pollOptionBarDemo">
                          <span>{opt}</span>
                          <div className="optionFillBar" style={{ width: `${(i + 1) * 25}%` }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeSlide.type === 'QA' && (
                  <div className="canvasQaDemo">
                    <div className="qaIcon">💬</div>
                    <h3>Fragen & Antworten</h3>
                    <p>Das Publikum kann auf ihren Geräten Fragen stellen.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar: Inspector */}
        <aside className="editorInspector">
          {activeSlide && (
            <div className="inspectorContent">
              <h2>Folien-Eigenschaften</h2>
              <div className="formGroup">
                <label>Design-Bibliothek</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {templates.map(template => <button key={template.name} type="button" onClick={() => setDesign(template)} style={{ background: template.background, color: template.foreground, border: '1px solid #888', borderRadius: 8, padding: 12, cursor: 'pointer' }}>{template.name}</button>)}
                </div>
              </div>
              <div className="formGroup"><label>Layout</label><select className="inspectorSelect" value={design.layout || 'classic'} onChange={e => setDesign({ layout: e.target.value })}><option value="classic">Klassisch</option><option value="center">Zentriert</option><option value="split">Zwei Spalten</option></select></div>
              <div className="formGroup"><label>Hintergrundfarbe</label><input aria-label="Hintergrundfarbe" type="color" value={design.background || '#ffffff'} onChange={e => setDesign({ background: e.target.value })}/></div>
              <div className="formGroup"><label>Textfarbe</label><input aria-label="Textfarbe" type="color" value={design.foreground || '#151923'} onChange={e => setDesign({ foreground: e.target.value })}/></div>
              <div className="formGroup"><label>Bild-URL (HTTPS)</label><input type="url" value={design.imageUrl || ''} placeholder="https://..." onChange={e => setDesign({ imageUrl: e.target.value })}/><button type="button" className="buttonGhost buttonSmall" onClick={() => setDesign({ imageUrl: '' })}>Bild entfernen</button></div>

              <div className="formGroup">
                <label>Folientyp</label>
                <select
                  value={activeSlide.type}
                  onChange={(e) => updateActiveSlide({ type: e.target.value as any })}
                  className="inspectorSelect"
                >
                  <option value="CONTENT">Inhalt & Text (CONTENT)</option>
                  <option value="POLL">Interaktive Umfrage (POLL)</option>
                  <option value="QA">Fragen & Antworten (Q&A)</option>
                </select>
              </div>

              <div className="formGroup">
                <label>Foliensuchzeile / Titel</label>
                <input
                  type="text"
                  value={activeSlide.title || ''}
                  onChange={(e) => updateActiveSlide({ title: e.target.value })}
                  placeholder="Titel eingeben..."
                />
              </div>

              <div className="formGroup">
                <label>Untertitel / Beschreibung</label>
                <input
                  type="text"
                  value={activeSlide.subtitle || ''}
                  onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
                  placeholder="Optionaler Untertitel..."
                />
              </div>

              {activeSlide.type === 'CONTENT' && (
                <div className="formGroup">
                  <label>Hauptinhalt</label>
                  <textarea
                    rows={6}
                    value={activeSlide.content || ''}
                    onChange={(e) => updateActiveSlide({ content: e.target.value })}
                    placeholder="Text oder Stichpunkte eingeben..."
                  />
                </div>
              )}

              {activeSlide.type === 'POLL' && (
                <div className="pollOptionsEditor">
                  <label className="optionsLabel">Antwort-Optionen</label>
                  {parsePollOptions(activeSlide.options).map((opt, i) => (
                    <div key={i} className="optionInputRow">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handlePollOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="removeOptionButton"
                        onClick={() => handleRemovePollOption(i)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="buttonGhost buttonSmall buttonBlock"
                    onClick={handleAddPollOption}
                    style={{ marginTop: '8px' }}
                  >
                    + Option hinzufügen
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
