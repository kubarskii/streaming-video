import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from '../../../shared/ui';

export const SearchBar = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to home page with search query
      navigate({ to: '/', search: { q: searchQuery.trim() } });
    }
  };

  return (
    <form className="header-search" onSubmit={handleSearch}>
      <div className="header-search-container">
        <input
          type="text"
          className="header-search-input"
          placeholder={t('header.search_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('header.search_placeholder')}
        />
        <button
          type="submit"
          className="header-search-btn"
          aria-label={t('common.search')}
          disabled={!searchQuery.trim()}
        >
          <SearchIcon size={20} />
        </button>
      </div>
    </form>
  );
};

