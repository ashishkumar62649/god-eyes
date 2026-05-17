import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchResult } from '../lib/searchTypes';
import { parseCoordinates } from '../lib/searchParser';
import { searchAirports } from '../lib/searchProviders';

interface SearchCommandProps {
  onResultSelect: (result: SearchResult) => void;
}

const SearchCommand: React.FC<SearchCommandProps> = ({ onResultSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setApiOffline(false);
      return;
    }

    setIsLoading(true);
    setApiOffline(false);
    
    // 1. Check for coordinates (LOCAL)
    const coordResult = parseCoordinates(searchQuery);
    
    // 2. Search for airports (API)
    let airportResults: SearchResult[] = [];
    try {
      airportResults = await searchAirports(searchQuery);
    } catch (err) {
      console.error('Airport search API offline:', err);
      setApiOffline(true);
    }

    const combinedResults: SearchResult[] = [];
    // Show coordinates first if valid
    if (coordResult) combinedResults.push(coordResult);
    combinedResults.push(...airportResults);

    setResults(combinedResults);
    setIsLoading(false);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    if (query.length > 1) {
      searchTimeoutRef.current = window.setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
      setIsLoading(false);
      setApiOffline(false);
    }

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, [query, performSearch]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex(prev => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    onResultSelect(result);
    setQuery('');
    setShowDropdown(false);
    setResults([]);
    setApiOffline(false);
  };

  return (
    <div className="shell-search-container" ref={containerRef}>
      <input 
        type="text" 
        className="shell-search-input" 
        placeholder="SEARCH PLACES, AIRPORTS, COORDINATES..." 
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => query.length > 1 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
      />
      
      {showDropdown && (query.length > 1) && (
        <div className="shell-search-results">
          {isLoading && <div className="search-status-msg">SYNCHRONIZING...</div>}
          
          {!isLoading && apiOffline && (
            <div className="search-status-msg" style={{ color: '#ff4d4d', opacity: 0.8 }}>AIRPORT API UNAVAILABLE</div>
          )}

          {!isLoading && results.length === 0 && !apiOffline && (
            <div className="search-status-msg">NO RESULTS FOUND</div>
          )}
          
          {results.map((result, index) => (
            <div 
              key={result.id} 
              className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-info">
                <div className="search-result-title">{result.title}</div>
                <div className="search-result-subtitle">{result.subtitle}</div>
              </div>
              <div className="search-result-type">{result.type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchCommand;
