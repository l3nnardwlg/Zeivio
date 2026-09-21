'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api';

interface Presentation {
  id: string;
  title: string;
  description?: string;
  slideCount: number;
  isPublished: boolean;
  accessCode: string;
  createdAt: string;
}

interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  presentationCount: number;
}

export default function DashboardPage() {
  const { user, token, isLoading, logout } = useAuth();
  const router = useRouter();

  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [usersList, setUsersList] = useState<UserSummary[]>([]);
  const [activeTab, setActiveTab] = useState<'presentations' | 'users'>('presentations');
  const [isFetching, setIsFetching] = useState(true);

  // New Presentation Modal state
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
      return;
    }

    if (token) {
      fetchDashboardData();
    }
  }, [token, isLoading, router]);

  const fetchDashboardData = async () => {
    setIsFetching(true);
    try {
      const [presRes, usersRes] = await Promise.all([
        apiRequest('/presentations'),
        apiRequest('/auth/users'),
      ]);
      setPresentations(presRes.presentations || []);
      setUsersList(usersRes.users || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const handleCreatePresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    setCreateError('');

    try {
      const data = await apiRequest('/presentations', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
        }),
      });

      setPresentations([data.presentation, ...presentations]);
      setShowModal(false);
      setNewTitle('');
      setNewDescription('');
    } catch (err: any) {
      setCreateError(err.message || 'Fehler beim Erstellen der Präsentation');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePresentation = async (id: string) => {
    if (!confirm('Möchtest du diese Präsentation wirklich löschen?')) return;

    try {
      await apiRequest(`/presentations/${id}`, { method: 'DELETE' });
      setPresentations(presentations.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || 'Fehler beim Löschen');
    }
  };

  if (isLoading || (!user && isFetching)) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>Lade Dashboard...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="dashboardLayout">
      <header className="dashboardHeader">
        <div className="headerLeft">
          <Link href="/" className="brand">
            <span className="brandMark">Z</span>
            <span>Zeivio</span>
          </Link>
          <span className="badge">Dashboard</span>
        </div>

        <nav className="headerNav">
          <button
            className={`tabButton ${activeTab === 'presentations' ? 'active' : ''}`}
            onClick={() => setActiveTab('presentations')}
          >
            Meine Präsentationen ({presentations.length})
          </button>
          <button
            className={`tabButton ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Alle Benutzer ({usersList.length})
          </button>
        </nav>

        <div className="headerRight">
          <Link href="/profile" className="profilePill">
            <div className="userAvatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="userInfoPill">
              <span className="userName">{user.name}</span>
              <span className="userEmail">{user.email}</span>
            </div>
          </Link>
          <button className="buttonGhost buttonSmall" onClick={logout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="dashboardContent">
        <div className="welcomeBanner">
          <div>
            <h1>Willkommen zurück, {user.name}!</h1>
            <p>Erstelle und verwalte deine interaktiven Präsentationen für dein Publikum.</p>
          </div>
          <button
            className="buttonPrimary buttonLarge"
            onClick={() => setShowModal(true)}
          >
            + Neue Präsentation
          </button>
        </div>

        {activeTab === 'presentations' && (
          <section className="presentationsSection">
            <div className="sectionHeader">
              <h2>Deine Präsentationen</h2>
              <span className="countBadge">{presentations.length} insgesamt</span>
            </div>

            {isFetching ? (
              <div className="loadingState">Präsentationen werden geladen...</div>
            ) : presentations.length === 0 ? (
              <div className="emptyState">
                <div className="emptyIcon">📊</div>
                <h3>Noch keine Präsentationen vorhanden</h3>
                <p>Erstelle jetzt deine erste interaktive Präsentation mit Umfragen und Live-Feedback.</p>
                <button
                  className="buttonPrimary"
                  onClick={() => setShowModal(true)}
                >
                  Erste Präsentation erstellen
                </button>
              </div>
            ) : (
              <div className="gridGrid">
                {presentations.map((pres) => (
                  <article key={pres.id} className="presentationCard">
                    <div className="cardTop">
                      <span className="codeBadge">Code: {pres.accessCode}</span>
                      <span className="slideCount">{pres.slideCount} Folien</span>
                    </div>

                    <h3>{pres.title}</h3>
                    <p>{pres.description || 'Keine Beschreibung vorhanden'}</p>

                    <div className="cardJoinUrl">
                      <span>Publikums-Link:</span>
                      <Link href={`/p/${pres.accessCode}`} target="_blank" className="linkCode">
                        zeiv.io/p/{pres.accessCode}
                      </Link>
                    </div>

                    <div className="cardFooter">
                      <span className="createdDate">
                        {new Date(pres.createdAt).toLocaleDateString('de-DE')}
                      </span>
                      <div className="cardActions">
                        <Link
                          href={`/editor/${pres.id}`}
                          className="buttonGhost buttonSmall"
                        >
                          Bearbeiten 
                        </Link>
                        <Link
                          href={`/present/${pres.id}`}
                          className="buttonPrimary buttonSmall"
                        >
                          Präsentieren 
                        </Link>
                        <button
                          className="buttonGhost buttonSmall textDanger"
                          onClick={() => handleDeletePresentation(pres.id)}
                          title="Präsentation löschen"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'users' && (
          <section className="usersSection">
            <div className="sectionHeader">
              <h2>Zeivio Benutzerübersicht</h2>
              <span className="countBadge">{usersList.length} Registrierte Benutzer</span>
            </div>

            <div className="usersTableContainer">
              <table className="usersTable">
                <thead>
                  <tr>
                    <th>Benutzer</th>
                    <th>E-Mail</th>
                    <th>Rolle</th>
                    <th>Präsentationen</th>
                    <th>Registriert am</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id} className={u.id === user.id ? 'currentUserRow' : ''}>
                      <td>
                        <div className="userCell">
                          <div className="userAvatarSmall">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <strong>{u.name}</strong>
                          {u.id === user.id && <span className="youBadge">Du</span>}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="roleTag">{u.role}</span>
                      </td>
                      <td>{u.presentationCount} Präsentationen</td>
                      <td>{new Date(u.createdAt).toLocaleDateString('de-DE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* New Presentation Modal */}
      {showModal && (
        <div className="modalOverlay" onClick={() => setShowModal(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2>Neue Präsentation erstellen</h2>
              <button
                className="closeButton"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {createError && <div className="authError">{createError}</div>}

            <form onSubmit={handleCreatePresentation} className="authForm">
              <div className="formGroup">
                <label htmlFor="title">Titel der Präsentation</label>
                <input
                  id="title"
                  type="text"
                  required
                  placeholder="z. B. Q3 Performance & Strategie"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="formGroup">
                <label htmlFor="description">Beschreibung (optional)</label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="Kurze Übersicht über das Thema..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="modalFooter">
                <button
                  type="button"
                  className="buttonGhost"
                  onClick={() => setShowModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="buttonPrimary"
                  disabled={isCreating}
                >
                  {isCreating ? 'Erstelle...' : 'Präsentation anlegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
