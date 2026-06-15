import React from 'react';
import type { AirportObject, MaritimeVesselObject } from '@god-eyes/contracts';
import IntelSection from '../intel/IntelSection';
import { useAirportPublicProfile } from '../../layers/aviation/airports/useAirportPublicProfile';
import { useAirportIntelligence } from '../../layers/aviation/airports/useAirportIntelligence';
import type { DetailPanelProps } from './detailTypes';
import { AviationDetail } from './AviationDetail';
import { MaritimeDetail } from './MaritimeDetail';
import { WeatherDetail } from './WeatherDetail';
import { NewsDetail } from './NewsDetail';
import { EnergyDetail } from './EnergyDetail';
import { DetailEmptyState } from './DetailEmptyState';

const spinner: React.CSSProperties = {
  display: 'inline-block', width: '8px', height: '8px',
  border: '2px solid var(--shell-text-dim)', borderTopColor: 'var(--shell-accent)',
  borderRadius: '50%', animation: 'spin 1s linear infinite',
};

export const DetailPanelRoot: React.FC<DetailPanelProps> = ({
  selectedObject,
  airportDetail,
  detailLoading,
  detailError,
  isCollapsed,
  setIsCollapsed,
  layoutPhase,
  selectedEnergyFeature,
  vesselDetail,
  selectedWeatherItem,
  selectedNewsItem,
}) => {
  const isVessel = selectedObject && 'layerId' in selectedObject && selectedObject.layerId === 'layer_06_maritime';
  const { state: profileState, retry } = useAirportPublicProfile(!isVessel && selectedObject ? selectedObject.id : null);
  const intelState = useAirportIntelligence(!isVessel && selectedObject ? selectedObject.id : null);

  const profile =
    profileState.phase === 'ok' || profileState.phase === 'stale' || profileState.phase === 'low_confidence'
      ? profileState.data : null;
  const attribution =
    profileState.phase === 'ok' || profileState.phase === 'stale' || profileState.phase === 'low_confidence'
      ? profileState.attribution : null;
  const fetchedAt =
    profileState.phase === 'ok' || profileState.phase === 'stale'
      ? profileState.fetchedAt : null;
  const intelImages = intelState.phase === 'ok' ? (intelState.data.images ?? null) : null;

  const headerContent = detailLoading ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ ...spinner, width: '10px', height: '10px' }} />
      Object Intel
    </span>
  ) : selectedEnergyFeature ? 'Energy Infrastructure'
    : selectedWeatherItem ? 'Weather'
    : selectedNewsItem ? 'News & OSINT'
    : 'Object Intel';

  return (
    <aside className={`shell-panel shell-panel-right shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
          {selectedEnergyFeature && <EnergyDetail feature={selectedEnergyFeature} />}

          {!selectedEnergyFeature && selectedWeatherItem && <WeatherDetail item={selectedWeatherItem} />}

          {!selectedEnergyFeature && !selectedWeatherItem && selectedNewsItem && <NewsDetail item={selectedNewsItem} />}

          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && !selectedObject && <DetailEmptyState />}

          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && selectedObject && isVessel && (
            <IntelSection title="Vessel Details">
              <MaritimeDetail
                vessel={selectedObject as MaritimeVesselObject}
                detail={vesselDetail}
                loading={detailLoading}
                error={detailError}
              />
            </IntelSection>
          )}

          {!selectedEnergyFeature && !selectedWeatherItem && !selectedNewsItem && selectedObject && !isVessel && (
            <AviationDetail
              airport={selectedObject as AirportObject}
              airportDetail={airportDetail}
              detailLoading={detailLoading}
              detailError={detailError}
              layoutPhase={layoutPhase}
              profile={profile}
              profilePhase={profileState.phase}
              onRetry={retry}
              intelImages={intelImages}
              attribution={attribution}
              fetchedAt={fetchedAt}
            />
          )}
        </div>
      )}
    </aside>
  );
};
