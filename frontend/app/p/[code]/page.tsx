'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';

interface Slide {
  id: string;
  orderIndex: number;
  type: 'CONTENT' | 'POLL' | 'QA';
  title: string;
  subtitle?: string;
  content?: string;
  options?: string;
}

interface Presentation {
  id: string;
  title: string;
  accessCode: string;
  owner: {
    name: string;
  };
  slides: Slide[];
}

export default function AudiencePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;

  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [votedSlides, setVotedSlides] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (code) {
      loadPublicPresentation(code);
    }
  }, [code]);

  const loadPublicPresentation = async (accessCode: string) => {
    setIsLoading(true);
    setError('');

    try {
      const res = await apiRequest(`/public/p/${accessCode}`);
      setPresentation(res.presentation);
    } catch (err: any) {
      setError(err.message || 'Präsentation konnte nicht gefunden werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (slideId: string, optionIndex: number) => {
    if (votedSlides[slideId] !== undefined || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiRequest('/public/vote', {
        method: 'POST',
        body: JSON.stringify({ slideId, optionIndex }),
      });

      setVotedSlides({ ...votedSlides, [slideId]: optionIndex });
    } catch (err: any) {
      alert(err.message || 'Fehler beim Abstimmen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsePollOptions = (optionsStr?: string): string[] => {
    if (!optionsStr) return [];
    try {
      return JSON.parse(optionsStr);
    } catch {
      return [];
    }
  };

  if (isLoading) {
    return (
      <div className="audienceLayout">
        <div className="loadingState">
          <div className="spinner" />
          <p>Verbinde mit Präsentation...</p>
        </div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="audienceLayout">
        <div className="audienceCard">
          <div className="audienceHeader">
            <Link href="/" className="brand">
              <span className="brandMark">Z</span>
              <span>Zeivio</span>
            </Link>
            <h1>Präsentation nicht gefunden</h1>
            <p>{error || 'Der eingegebene Code ist ungültig oder abgelaufen.'}</p>
          </div>

          <div className="authFooter">
            <Link href="/" className="buttonPrimary buttonBlock">
              Zurück zur Startseite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="audienceLayout">
      <header className="audienceTopNav">
        <div className="brand">
          <span className="brandMark">Z</span>
          <span>Zeivio</span>
        </div>
        <div className="roomCodeBadge">Code: {presentation.accessCode}</div>
      </header>

      <main className="audienceContent">
        <div className="presentationHeaderBanner">
          <h2>{presentation.title}</h2>
          <span className="presenterName">Präsentiert von {presentation.owner?.name}</span>
        </div>

        <div className="audienceSlidesContainer">
          {presentation.slides.map((slide, index) => {
            const options = parsePollOptions(slide.options);
            const userVotedIndex = votedSlides[slide.id];

            return (
              <article key={slide.id} className="audienceSlideCard">
                <div className="slideCardHeader">
                  <span className="slideIndexTag">Folie {index + 1}</span>
                  <span className="slideTypeTag">{slide.type}</span>
                </div>

                <h3>{slide.title}</h3>
                {slide.subtitle && <p className="slideSubtitle">{slide.subtitle}</p>}

                {slide.type === 'CONTENT' && slide.content && (
                  <div className="audienceSlideText">{slide.content}</div>
                )}

                {slide.type === 'POLL' && (
                  <div className="audiencePollSection">
                    {userVotedIndex !== undefined ? (
                      <div className="votedConfirmation">
                        <span className="checkIcon">✓</span>
                        <div>
                          <strong>Danke für deine Stimme!</strong>
                          <p>Du hast für "{options[userVotedIndex]}" gestimmt.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="audienceOptionsGrid">
                        {options.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            className="audienceOptionButton"
                            onClick={() => handleVote(slide.id, optIdx)}
                            disabled={isSubmitting}
                          >
                            <span className="optionIndexLetter">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="optionText">{opt}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {slide.type === 'QA' && (
                  <div className="audienceQaBox">
                    <p>💬 Fragen können direkt an den Präsentierenden gestellt werden.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>

      <footer className="audienceFooter">
        <span>Verbunden mit <strong>zeiv.io</strong></span>
      </footer>
    </div>
  );
}
