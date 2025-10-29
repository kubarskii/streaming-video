import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { SearchIcon } from '../../../shared/ui';

export const SearchBar = () => {
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
          placeholder="Search videos, channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search videos and channels"
        />
        <button
          type="submit"
          className="header-search-btn"
          aria-label="Search"
          disabled={!searchQuery.trim()}
        >
          <SearchIcon size={20} />
        </button>
      </div>
    </form>
  );
};

