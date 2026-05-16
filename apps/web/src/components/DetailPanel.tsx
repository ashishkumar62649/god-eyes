import React from 'react';
import { AirportObject, AirportDetailResponse } from '@god-eyes/contracts';
import IntelSection from './intel/IntelSection';
import AirportOverview from './intel/AirportOverview';
import CoordinateSourceCard from './intel/CoordinateSourceCard';
import RunwaysSection from './intel/RunwaysSection';
import FrequenciesSection from './intel/FrequenciesSection';
import NearbyNavaidsSection from './intel/NearbyNavaidsSection';
import DataQualityCard from './intel/DataQualityCard';

interface DetailPanelProps {
  selectedObject: AirportObject | null;
  airportDetail: AirportDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const styles: Record<string, React.CSSProperties> = {
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--shell-text-dim)',
    fontSize: '0.75rem',
    letterSpacing: '1px',
    textAlign: 'center',
    padding: '0 20px',
  },
  error: {
    padding: '12px',
    fontSize: '0.65rem',
    color: '#f87171',
    textAlign: 'center',
    background: 'rgba(248, 113, 113, 0.1)',
    borderRadius: '4px',
    margin: '8px 0',
  },
};

const DetailPanel: React.FC<DetailPanelProps> = ({ 
  selectedObject, 
  airportDetail,
  detailLoading,
  detailError,
  isCollapsed, 
  setIsCollapsed 
}) => {
  const headerContent = detailLoading ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ 
        display: 'inline-block', width: '10px', height: '10px', 
        border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      Object Intel
    </span>
  ) : 'Object Intel';

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="panel-header">
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '\u00AB' : '\u00BB'}
        </button>
        {!isCollapsed && headerContent}
      </div>
      
      {isCollapsed ? (
        <div className="collapsed-label">INTEL</div>
      ) : (
        <div className="panel-content">
          {!selectedObject ? (
            <div style={styles.empty}>
              <div style={{ opacity: 0.5, marginBottom: '16px', fontSize: '2rem' }}>{'\u2316'}</div>
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

              {detailError && !detailLoading && (
                <div>
                  <div style={styles.error}>Unable to load details</div>
                  <div style={{ fontSize: '0.6rem', textAlign: 'center', opacity: 0.6, marginBottom: '8px' }}>
                    {detailError.includes('Failed to fetch') ? 'Offline - Details unavailable' : detailError}
                  </div>
                </div>
              )}

              {airportDetail && (
                <>
                  <RunwaysSection runways={airportDetail.runways} />
                  <FrequenciesSection frequencies={airportDetail.frequencies} />
                  <NearbyNavaidsSection navaids={airportDetail.nearbyNavaids} />
                  <IntelSection title="">
                    <DataQualityCard 
                      sourceId={selectedObject.sourceId} 
                      metadata={airportDetail.metadata} 
                    />
                  </IntelSection>
                </>
              )}

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
