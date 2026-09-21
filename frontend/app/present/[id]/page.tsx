'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { apiRequest } from '../../../lib/api';

interface PollVote {
  id: string;
  slideId: string;
  optionIndex: number;
}

interface Slide {
  id: string;
  presentationId: string;
  orderIndex: number;
  type: 'CONTENT' | 'POLL' | 'QA';
  title: string;
  subtitle?: string;
  content?: string;
  options?: string;
  votes?: PollVote[];
}

interface Presentation {
  id: string;
  title: string;
  accessCode: string;
}

export default function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const presentationId = resolvedParams.id;

  const { token } = useAuth();
  const router = useRouter();

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();

    // Poll votes every 3 seconds during live presentation
    const interval = setInterval(() => {
      refreshVotes();
    }, 3000);

    return () => clearInterval(interval);
  }, [presentationId]);

  const loadData = async () => {
    try {
      const presRes = await apiRequest(`/presentations/${presentationId}`);
      setPresentation(presRes.presentation);

      const slidesRes = await apiRequest(`/slides/presentation/${presentationId}`);
      setSlides(slidesRes.slides || []);
    } catch (err) {
      console.error('Failed to load presentation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshVotes = async () => {
    try {
      const slidesRes = await apiRequest(`/slides/presentation/${presentationId}`);
      setSlides(slidesRes.slides || []);
    } catch (err) {
      console.error('Failed to refresh votes:', err);
    }
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        prevSlide();
      } else if (e.key === 'Escape') {
        router.push(`/editor/${presentationId}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, slides.length, presentationId, router]);

  if (isLoading || !presentation) {
    return (
      <div className="loadingState" style={{ height: '100vh', background: '#000' }}>
        <div className="spinner" />
        <p>Lade Präsentation...</p>
      </div>
    );
  }

  const currentSlide = slides[currentIndex];

  const parsePollOptions = (optionsStr?: string): string[] => {
    if (!optionsStr) return [];
    try {
      return JSON.parse(optionsStr);
    } catch {
      return [];
    }
  };

  const options = parsePollOptions(currentSlide?.options);
  const votes = currentSlide?.votes || [];
  const totalVotes = votes.length;

  const getVoteCountForOption = (optionIndex: number) => {
    return votes.filter((v) => v.optionIndex === optionIndex).length;
  };

  const getVotePercentageForOption = (optionIndex: number) => {
    if (totalVotes === 0) return 0;
    const count = getVoteCountForOption(optionIndex);
    return Math.round((count / totalVotes) * 100);
  };

  return (
    <div className="presenterLayout">
      {/* Top Banner */}
      <div className="presenterHeader">
        <div className="presenterBrand">
          <span className="brandMark">Z</span>
          <span>Zeivio Presenter</span>
        </div>

        <div className="joinCallout">
          <span>Auf Smartphone mitmachen:</span>
          <strong>zeiv.io/p/{presentation.accessCode}</strong>
        </div>

        <Link href={`/editor/${presentationId}`} className="exitPresentButton">
          Editor beenden ✕
        </Link>
      </div>

      {/* Main Slide Stage */}
      <main className="presenterStage">
        {currentSlide && (
          <div className="stageCard">
            <h1 className="stageTitle">{currentSlide.title}</h1>
            {currentSlide.subtitle && <h2 className="stageSubtitle">{currentSlide.subtitle}</h2>}

            {currentSlide.type === 'CONTENT' && (
              <div className="stageContent">
                <p>{currentSlide.content}</p>
              </div>
            )}

            {currentSlide.type === 'POLL' && (
              <div className="stagePollBox">
                <div className="pollHeader">
                  <span>Stimmen insgesamt: <strong>{totalVotes}</strong></span>
                </div>

                <div className="pollBarsContainer">
                  {options.map((opt, i) => {
                    const count = getVoteCountForOption(i);
                    const pct = getVotePercentageForOption(i);
                    return (
                      <div key={i} className="pollBarRow">
                        <div className="pollOptionLabelRow">
                          <span className="pollOptionText">{opt}</span>
                          <span className="pollOptionStats">
                            {count} {count === 1 ? 'Stimme' : 'Stimmen'} ({pct}%)
                          </span>
                        </div>
                        <div className="pollTrack">
                          <div
                            className="pollFill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentSlide.type === 'QA' && (
              <div className="stageQaBox">
                <div className="qaIconBig">💬</div>
                <h2>Fragen aus dem Publikum</h2>
                <p>Das Publikum kann Fragen unter <strong>zeiv.io/p/{presentation.accessCode}</strong> einreichen.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Control Footer */}
      <footer className="presenterFooter">
        <button
          className="navArrowButton"
          onClick={prevSlide}
          disabled={currentIndex === 0}
        >
          ← Vorherige
        </button>

        <span className="slideCounter">
          Folie {currentIndex + 1} von {slides.length}
        </span>

        <button
          className="navArrowButton"
          onClick={nextSlide}
          disabled={currentIndex === slides.length - 1}
        >
          Nächste →
        </button>
      </footer>
    </div>
  );
}
