'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { apiRequest } from '../../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      login(data.token, data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
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
          <h1>Willkommen zurück</h1>
          <p>Melde dich an, um auf deine Präsentationen zuzugreifen.</p>
        </div>

        {error && <div className="authError">{error}</div>}

        <form onSubmit={handleSubmit} className="authForm">
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="buttonPrimary buttonBlock"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Anmelden...' : 'Anmelden →'}
          </button>
        </form>

        <div className="authFooter">
          <span>Noch kein Konto? </span>
          <Link href="/register">Jetzt registrieren</Link>
        </div>
      </div>
    </div>
  );
}
