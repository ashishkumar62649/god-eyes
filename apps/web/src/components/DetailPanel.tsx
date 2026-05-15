import React from 'react';
import { AirportObject } from '@god-eyes/contracts';
import IntelSection from './intel/IntelSection';
import AirportOverview from './intel/AirportOverview';
import CoordinateSourceCard from './intel/CoordinateSourceCard';
import AviationDetailPlaceholders from './intel/AviationDetailPlaceholders';

interface DetailPanelProps {
  selectedObject: AirportObject | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ 
  selectedObject, 
  isCollapsed, 
  setIsCollapsed 
}) => {

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '«' : '»'}
        </button>
        {!isCollapsed && <span>Object Intel</span>}
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">INTEL</div>
      ) : (
        <div className="panel-content">
          {!selectedObject ? (
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--shell-text-dim)', 
              fontSize: '0.75rem',
              letterSpacing: '1px',
              textAlign: 'center',
              padding: '0 20px'
            }}>
              <div style={{ opacity: 0.5, marginBottom: '16px', fontSize: '2rem' }}>⌖</div>
              SELECT AN AIRPORT OR SEARCH TO INSPECT OBJECT INTELLIGENCE
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <IntelSection title="Overview">
                <AirportOverview airport={selectedObject} />
              </IntelSection>

              <IntelSection title="Location & Source">
                <CoordinateSourceCard airport={selectedObject} />
              </IntelSection>

              <AviationDetailPlaceholders />

              <div style={{ 
                marginTop: '12px', 
                borderTop: '1px solid rgba(255, 255, 255, 0.05)', 
                paddingTop: '20px',
                opacity: 0.3,
                fontSize: '0.6rem',
                fontFamily: 'var(--shell-font-mono)'
              }}>
                SYSTEM ID: {selectedObject.id}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
