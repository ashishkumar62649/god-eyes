import React, { useState } from 'react';
import type { LayerRegistryEntry } from '@god-eyes/contracts';
import { useLayerRegistry } from '../../lib/useLayerRegistry';
import type { LayerPanelProps } from './layerPanelTypes';
import { AviationControls } from './AviationControls';
import { SpaceControls } from './SpaceControls';
import { MaritimeControls } from './MaritimeControls';
import { WeatherControls } from './WeatherControls';
import { NewsControls } from './NewsControls';
import { EnergyControls } from './EnergyControls';
import type { EarthEventsPhase } from '../../layers/earth-events/useEarthEvents';
import type { BordersPhase } from '../../layers/borders/useBordersBoundaries';

function statusLabel(entry: LayerRegistryEntry): string {
  if (entry.status === 'active') return 'ACTIVE';
  if (entry.status === 'coming_soon') return 'COMING SOON';
  return 'NO DATA YET';
}

function earthEventsStatusText(active: boolean, phase: EarthEventsPhase): string {
  if (!active) return 'READY — CLICK TO ACTIVATE';
  switch (phase.phase) {
    case 'loading': return 'LOADING...';
    case 'ok': return `ACTIVE — ${phase.events.length} EVENTS`;
    case 'empty': return 'ACTIVE — NO DATA';
    case 'error': return 'ERROR — LAYER OFFLINE';
    default: return 'ACTIVE';
  }
}

function bordersStatusText(active: boolean, phase: BordersPhase): string {
  if (!active) return 'READY — CLICK TO ACTIVATE';
  switch (phase.phase) {
    case 'loading': return 'LOADING...';
    case 'ok': return `ACTIVE — ${phase.data.features.length} COUNTRIES`;
    case 'error': return 'ERROR — LAYER OFFLINE';
    default: return 'ACTIVE';
  }
}

export const LayerPanelRoot: React.FC<LayerPanelProps> = ({
  aviationLayerActive, setAviationLayerActive, aviationStats, aviationFilters, onFiltersChange,
  earthEventsLayerActive, setEarthEventsLayerActive, earthEventsPhase,
  bordersLayerActive, setBordersLayerActive, bordersPhase,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase,
  spaceSatellitesLayerActive, setSpaceSatellitesLayerActive, spaceSatellitesStatus, spaceSatelliteFilters, onSpaceFiltersChange,
  energyInfrastructureLayerActive, setEnergyInfrastructureLayerActive, energyInfrastructureFilters, onEnergyFiltersChange,
  maritimeLayerActive, setMaritimeLayerActive, maritimeStats, maritimeFilters, onMaritimeFiltersChange, onMaritimeRefresh,
  weatherLayerActive, setWeatherLayerActive, weatherLoading, weatherError, weatherEmpty, weatherCount, weatherAttribution, onWeatherRefresh,
  newsLayerActive, setNewsLayerActive, newsLoading, newsError, newsEmpty, newsMarkerCount, newsTotal,
  newsStats, newsFilters, newsItems, onNewsFiltersChange, onNewsRefresh, onNewsSelect,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { layers, apiAvailable, loading } = useLayerRegistry();

  return (
    <aside className={`shell-panel shell-panel-left shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>Operations</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>{isCollapsed ? '»' : '«'}</button>
      </div>

      {isCollapsed ? (
        <div className="collapsed-label">OPERATIONS</div>
      ) : (
        <div className="panel-content">
          {!loading && !apiAvailable && (
            <div style={{ fontSize: '0.55rem', color: '#ffab00', opacity: 0.7, marginBottom: '6px', letterSpacing: '0.5px' }}>
              REGISTRY OFFLINE — LOCAL DATA
            </div>
          )}

          {layers.map((entry) => {
            const layerIndex = entry.layerId.match(/layer_(\d+)/)?.[1] ?? '';

            if (entry.layerId === 'layer_00_globe_core') {
              return (
                <div key={entry.layerId} className="layer-item active" style={{ cursor: 'default' }}>
                  <div className="layer-name">{entry.name} [L0]</div>
                  <div className="layer-status" style={{ opacity: 0.8 }}>ONLINE — ACTIVE</div>
                </div>
              );
            }

            if (entry.layerId === 'layer_01_aviation') {
              return (
                <React.Fragment key={entry.layerId}>
                  <AviationControls
                    aviationLayerActive={aviationLayerActive} setAviationLayerActive={setAviationLayerActive}
                    aviationStats={aviationStats} aviationFilters={aviationFilters} onFiltersChange={onFiltersChange}
                    liveAircraftLayerActive={liveAircraftLayerActive} setLiveAircraftLayerActive={setLiveAircraftLayerActive}
                    liveAircraftPhase={liveAircraftPhase} entry={entry}
                  />
                </React.Fragment>
              );
            }

            if (entry.layerId === 'layer_02_borders_boundaries') {
              return (
                <div key={entry.layerId} className={`layer-item ${bordersLayerActive ? 'active' : ''}`}
                  onClick={() => setBordersLayerActive(!bordersLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">Borders & Boundaries [L2]</div>
                  <div className="layer-status">
                    <span style={{ color: bordersLayerActive ? 'var(--shell-accent)' : undefined, fontWeight: bordersLayerActive ? 600 : undefined, opacity: bordersLayerActive ? 1 : 0.7 }}>
                      {bordersStatusText(bordersLayerActive, bordersPhase)}
                    </span>
                  </div>
                  {bordersLayerActive && <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>Natural Earth MVP/local/dev boundaries. Not production-approved. Not Survey of India compliant.</div>}
                </div>
              );
            }

            if (entry.layerId === 'layer_03_earth_events') {
              return (
                <div key={entry.layerId} className={`layer-item ${earthEventsLayerActive ? 'active' : ''}`}
                  onClick={() => setEarthEventsLayerActive(!earthEventsLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L3]</div>
                  <div className="layer-status">
                    <span style={{ color: earthEventsLayerActive ? 'var(--shell-accent)' : undefined, fontWeight: earthEventsLayerActive ? 600 : undefined, opacity: earthEventsLayerActive ? 1 : 0.7 }}>
                      {earthEventsStatusText(earthEventsLayerActive, earthEventsPhase)}
                    </span>
                  </div>
                </div>
              );
            }

            if (entry.layerId === 'layer_05_space_satellites') {
              return (
                <React.Fragment key={entry.layerId}>
                  <SpaceControls
                    active={spaceSatellitesLayerActive} setActive={setSpaceSatellitesLayerActive}
                    status={spaceSatellitesStatus} filters={spaceSatelliteFilters} onFiltersChange={onSpaceFiltersChange}
                    entry={entry}
                  />
                </React.Fragment>
              );
            }

            if (entry.layerId === 'layer_06_maritime') {
              return (
                <React.Fragment key={entry.layerId}>
                  <MaritimeControls
                    active={maritimeLayerActive} setActive={setMaritimeLayerActive}
                    stats={maritimeStats} filters={maritimeFilters} onFiltersChange={onMaritimeFiltersChange}
                    onRefresh={onMaritimeRefresh} entry={entry}
                  />
                </React.Fragment>
              );
            }

            if (entry.layerId === 'layer_07_weather') {
              return (
                <React.Fragment key={entry.layerId}>
                  <WeatherControls
                    active={weatherLayerActive} setActive={setWeatherLayerActive}
                    loading={weatherLoading} error={weatherError} empty={weatherEmpty}
                    count={weatherCount} attribution={weatherAttribution} onRefresh={onWeatherRefresh}
                    entry={entry}
                  />
                </React.Fragment>
              );
            }

            if (entry.layerId === 'layer_08_news_osint') {
              return (
                <React.Fragment key={entry.layerId}>
                  <NewsControls
                    active={newsLayerActive} setActive={setNewsLayerActive}
                    loading={newsLoading} error={newsError} empty={newsEmpty}
                    markerCount={newsMarkerCount} total={newsTotal} stats={newsStats}
                    filters={newsFilters} items={newsItems}
                    onFiltersChange={onNewsFiltersChange} onRefresh={onNewsRefresh} onSelect={onNewsSelect}
                    entry={entry}
                  />
                </React.Fragment>
              );
            }

            if (entry.layerId === 'layer_10_energy_infrastructure') {
              return (
                <React.Fragment key={entry.layerId}>
                  <EnergyControls
                    active={energyInfrastructureLayerActive} setActive={setEnergyInfrastructureLayerActive}
                    filters={energyInfrastructureFilters} onFiltersChange={onEnergyFiltersChange}
                    entry={entry}
                  />
                </React.Fragment>
              );
            }

            const isInactive = entry.status !== 'active';
            return (
              <div key={entry.layerId} className="layer-item" style={{ cursor: 'default', opacity: 0.45 }}>
                <div className="layer-name">{entry.name}{layerIndex ? ` [L${parseInt(layerIndex, 10)}]` : ''}</div>
                <div className="layer-status">
                  <span style={{ color: isInactive ? '#ffab00' : 'var(--shell-accent)', fontSize: '0.6rem', letterSpacing: '1px' }}>
                    {statusLabel(entry)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
