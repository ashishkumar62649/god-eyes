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
              textAlign: 'center', 
              color: 'var(--shell-text-dim)', 
              marginTop: '40px',
              fontSize: '0.75rem',
              letterSpacing: '1px'
            }}>
              NO OBJECT SELECTED
            </div>
          ) : (
            <div style={{ marginTop: '10px' }}>
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: 800, 
                color: 'var(--shell-accent)',
                marginBottom: '20px',
                borderBottom: '1px solid var(--shell-border)',
                paddingBottom: '10px'
              }}>
                {selectedObject.name}
              </div>

              <div className="detail-row">
                <div className="detail-label">Identity / Ident</div>
                <div className="detail-value">{selectedObject.ident} {selectedObject.iataCode ? `(${selectedObject.iataCode})` : ''}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Category / Type</div>
                <div className="detail-value">{selectedObject.category} / {selectedObject.typeSource}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-label">Location / Region</div>
                <div className="detail-value">{selectedObject.municipality || '—'}, {selectedObject.region}, {selectedObject.country}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Coordinates</div>
                <div className="detail-value" style={{ fontSize: '0.75rem' }}>
                  LAT: {selectedObject.position.latitude?.toFixed(6)}<br />
                  LON: {selectedObject.position.longitude?.toFixed(6)}
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Elevation</div>
                <div className="detail-value">{selectedObject.elevationFt ? `${selectedObject.elevationFt.toLocaleString()} FT` : '—'}</div>
              </div>
              
              <div className="detail-row">
                <div className="detail-label">Data Source</div>
                <div className="detail-value">{selectedObject.sourceId}</div>
              </div>

              <div className="detail-row">
                <div className="detail-label">Internal ID</div>
                <div className="detail-value" style={{ fontSize: '0.6rem', opacity: 0.5 }}>{selectedObject.id}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default DetailPanel;
