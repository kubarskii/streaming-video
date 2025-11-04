// Pages: Register Page
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../shared/context/AuthContext';
import './AuthPage.css';

export const RegisterPage = () => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (password !== confirmPassword) {
            setError(t('auth.passwords_not_match'));
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await register(email, username, password);
            navigate({ to: '/login' });
        } catch (err) {
            setError(err.response?.data?.error || t('auth.register_failed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-logo">
                        <svg width="48" height="48" viewBox="0 0 32 32" fill="#ff0000">
                            <path d="M4 4h24v24H4z" opacity="0.2" />
                            <path d="M12 9l12 7-12 7V9z" />
                        </svg>
                    </div>

                    <h1 className="auth-title">{t('auth.sign_up_title')}</h1>
                    <p className="auth-subtitle">{t('auth.sign_up_subtitle')}</p>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">
                                {t('auth.email')}
                            </label>
                            <input
                                type="email"
                                id="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="username" className="form-label">
                                {t('auth.username')}
                            </label>
                            <input
                                type="text"
                                id="username"
                                className="form-input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                pattern="[a-zA-Z0-9_]{3,20}"
                                title="3-20 characters (letters, numbers, underscore)"
                            />
                            <small className="form-hint">
                                3-20 characters (letters, numbers, underscore)
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password" className="form-label">
                                {t('auth.password')}
                            </label>
                            <input
                                type="password"
                                id="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="8"
                            />
                            <small className="form-hint">
                                At least 8 characters
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword" className="form-label">
                                {t('auth.confirm_password')}
                            </label>
                            <input
                                type="password"
                                id="confirmPassword"
                                className="form-input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading}
                        >
                            {loading ? t('auth.signing_up') : t('auth.sign_up')}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            {t('auth.have_account')}{' '}
                            <Link to="/login" className="auth-link">
                                {t('auth.sign_in')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
