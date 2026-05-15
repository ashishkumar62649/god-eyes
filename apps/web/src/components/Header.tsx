import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="shell-header shell-interactive">
      <div className="shell-brand">
        GOD EYES / <span style={{ opacity: 0.5, fontWeight: 400 }}>WORLD INTEL</span>
      </div>
      
      <div className="shell-search-container">
        <input 
          type="text" 
          className="shell-search-input" 
          placeholder="SEARCH GLOBAL INTELLIGENCE..." 
          readOnly
        />
      </div>
      
      <div className="shell-status-indicator">
        <div className="status-dot"></div>
        <span>CORE READY</span>
      </div>
    </header>
  );
};

export default Header;
