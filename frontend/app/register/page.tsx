'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { registerUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      registerUser(data.token, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registrierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="authContainer">
      <div className="authCard">
        <div className="authHeader">
          <Link href="/" className="brand">
            <span className="brandMark">Z</span>
            <span>Zeivio</span>
          </Link>
          <h1>Konto erstellen</h1>
          <p>Starte mit interaktiven Präsentationen für deine Zielgruppe.</p>
        </div>

        {error && <div className="authError">{error}</div>}

        <form onSubmit={handleSubmit} className="authForm">
          <div className="formGroup">
            <label htmlFor="name">Vollständiger Name</label>
            <input
              id="name"
              type="text"
              required
              placeholder="Max Mustermann"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              required
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="formGroup">
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              placeholder="Mindestens 6 Zeichen"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="buttonPrimary buttonBlock"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Konto wird erstellt...' : 'Kostenlos registrieren →'}
          </button>
        </form>

        <div className="authFooter">
          <span>Bereits registriert? </span>
          <Link href="/login">Hier anmelden</Link>
        </div>
      </div>
    </div>
  );
}
