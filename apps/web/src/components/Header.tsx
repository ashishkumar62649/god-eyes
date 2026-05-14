import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="shell-header shell-interactive">
      <div className="shell-brand">World Intelligence Globe</div>
      
      <div className="shell-search-container">
        <input 
          type="text" 
          className="shell-search-input" 
          placeholder="Search location, airport, city, coordinate..." 
        />
      </div>
      
      <div className="shell-status-indicator">
        <div className="status-dot"></div>
        <span>Layer 0 Online</span>
      </div>
    </header>
  );
};

export default Header;
