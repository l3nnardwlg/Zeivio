'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api';

export default function ProfilePage() {
  const { user, token, isLoading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ presentationCount: 0 });

  useEffect(() => {
    if (!isLoading && !token) {
      router.push('/login');
      return;
    }

    if (token) {
      refreshUser();
      apiRequest('/presentations').then((res) => {
        setStats({ presentationCount: res.presentations?.length || 0 });
      }).catch(console.error);
    }
  }, [token, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="loadingState">
        <div className="spinner" />
        <p>Lade Profil...</p>
      </div>
    );
  }

  return (
    <div className="dashboardLayout">
      <header className="dashboardHeader">
        <div className="headerLeft">
          <Link href="/" className="brand">
            <span className="brandMark">Z</span>
            <span>Zeivio</span>
          </Link>
          <span className="badge">Profil</span>
        </div>

        <nav className="headerNav">
          <Link href="/dashboard" className="tabButton">
            ← Zurück zum Dashboard
          </Link>
        </nav>

        <div className="headerRight">
          <button className="buttonGhost buttonSmall" onClick={logout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="dashboardContent">
        <div className="profileContainer">
          <div className="profileHeaderCard">
            <div className="profileAvatarBig">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="profileHeaderInfo">
              <h1>{user.name}</h1>
              <p className="profileEmail">{user.email}</p>
              <div className="profileBadges">
                <span className="roleBadge">{user.role}</span>
                <span className="dateBadge">
                  Mitglied seit {new Date(user.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          </div>

          <div className="profileGrid">
            <div className="profileCard">
              <h2>Konto-Details</h2>

              <div className="infoList">
                <div className="infoItem">
                  <span className="infoLabel">Vollständiger Name</span>
                  <span className="infoValue">{user.name}</span>
                </div>

                <div className="infoItem">
                  <span className="infoLabel">E-Mail-Adresse</span>
                  <span className="infoValue">{user.email}</span>
                </div>

                <div className="infoItem">
                  <span className="infoLabel">Benutzer-ID</span>
                  <span className="infoValue codeValue">{user.id}</span>
                </div>

                <div className="infoItem">
                  <span className="infoLabel">Konto-Status</span>
                  <span className="infoValue statusActive">Aktiv</span>
                </div>
              </div>
            </div>

            <div className="profileCard">
              <h2>Aktivitätsübersicht</h2>

              <div className="statsGrid">
                <div className="statBox">
                  <span className="statNumber">{stats.presentationCount}</span>
                  <span className="statLabel">Erstellte Präsentationen</span>
                </div>

                <div className="statBox">
                  <span className="statNumber">0</span>
                  <span className="statLabel">Interaktive Sessions</span>
                </div>
              </div>

              <div className="quickActions">
                <Link href="/dashboard" className="buttonPrimary buttonBlock">
                  Präsentationen verwalten
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
