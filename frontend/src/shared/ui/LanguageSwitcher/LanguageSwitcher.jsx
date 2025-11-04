// Language Switcher Component
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' }
  ];

  const changeLanguage = (languageCode) => {
    i18n.changeLanguage(languageCode);
  };

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className="language-switcher">
      <button 
        className="language-button"
        aria-label="Change language"
      >
        <span className="language-flag">{currentLanguage.flag}</span>
        <span className="language-name">{currentLanguage.name}</span>
      </button>
      <div className="language-dropdown">
        {languages.map((language) => (
          <button
            key={language.code}
            className={`language-option ${i18n.language === language.code ? 'active' : ''}`}
            onClick={() => changeLanguage(language.code)}
            aria-label={`Switch to ${language.name}`}
          >
            <span className="language-flag">{language.flag}</span>
            <span className="language-name">{language.name}</span>
            {i18n.language === language.code && (
              <span className="language-check">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

