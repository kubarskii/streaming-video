// Pages: Login Page
import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '../../shared/context/AuthContext';
import { useTranslation } from 'react-i18next';
import './AuthPage.css';

export const LoginPage = () => {
    const { t } = useTranslation();
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(emailOrUsername, password);
            navigate({ to: '/' });
        } catch (err) {
            setError(err.response?.data?.error || t('auth.login_failed'));
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

                    <h1 className="auth-title">{t('auth.sign_in_title')}</h1>
                    <p className="auth-subtitle">{t('auth.sign_in_subtitle')}</p>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="emailOrUsername" className="form-label">
                                {t('auth.email_or_username')}
                            </label>
                            <input
                                type="text"
                                id="emailOrUsername"
                                className="form-input"
                                value={emailOrUsername}
                                onChange={(e) => setEmailOrUsername(e.target.value)}
                                required
                                autoFocus
                            />
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
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading}
                        >
                            {loading ? t('auth.signing_in') : t('auth.sign_in')}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            {t('auth.no_account')}{' '}
                            <Link to="/register" className="auth-link">
                                {t('auth.sign_up')}
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
