import React from 'react';
import { AirportObject } from '@god-eyes/contracts';

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
              letterSpacing: '1px'
            }}>
              NO OBJECT SELECTED
            </div>
          ) : (
            <div style={{ marginTop: '10px' }}>
              <div style={{ 
                fontSize: '1.1rem', 
                fontWeight: 700, 
                color: 'var(--shell-accent)',
                marginBottom: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '12px',
                lineHeight: 1.3
              }}>
                {selectedObject.name}
              </div>

              <div className="detail-row">
                <div className="detail-label">Identity / Code</div>
                <div className="detail-value">{selectedObject.ident} {selectedObject.iataCode ? `(${selectedObject.iataCode})` : ''}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Category</div>
                <div className="detail-value">{selectedObject.category}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-label">Location</div>
                <div className="detail-value">{selectedObject.municipality ? `${selectedObject.municipality}, ` : ''}{selectedObject.region}, {selectedObject.country}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Coordinates</div>
                <div className="detail-value" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  LAT {selectedObject.position.latitude?.toFixed(6)}<br />
                  LON {selectedObject.position.longitude?.toFixed(6)}
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Elevation</div>
                <div className="detail-value">{selectedObject.elevationFt !== null ? `${selectedObject.elevationFt.toLocaleString()} FT` : '—'}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-label">Source System</div>
                <div className="detail-value">{selectedObject.sourceId}</div>
              </div>

              <div className="detail-row" style={{ border: 'none', paddingLeft: 0, marginTop: '30px' }}>
                <div className="detail-label">Internal Reference</div>
                <div className="detail-value" style={{ fontSize: '0.6rem', opacity: 0.4 }}>{selectedObject.id}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
