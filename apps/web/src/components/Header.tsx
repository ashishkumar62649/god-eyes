import React from 'react';
import SearchCommand from './SearchCommand';
import { SearchResult } from '../lib/searchTypes';

interface HeaderProps {
  onSearchResultSelect: (result: SearchResult) => void;
}

const Header: React.FC<HeaderProps> = ({ onSearchResultSelect }) => {
  return (
    <header className="shell-header shell-interactive">
      <div className="shell-brand">
        GOD EYES / <span style={{ opacity: 0.5, fontWeight: 400 }}>WORLD INTEL</span>
      </div>
      
      <SearchCommand onResultSelect={onSearchResultSelect} />
      
      <div className="shell-status-indicator">
        <div className="status-dot"></div>
        <span>CORE READY</span>
      </div>
    </header>
  );
};

export default Header;
