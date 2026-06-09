import React, { useState } from 'react';
import type { LayerRegistryEntry, MaritimeStatsResponse } from '@god-eyes/contracts';
import { AviationFilters, AVIATION_CATEGORIES } from '../layers/aviation/airports/aviationCategories';
import { useLayerRegistry } from '../lib/useLayerRegistry';
import type { EarthEventsPhase } from '../layers/earth-events/useEarthEvents';
import type { BordersPhase } from '../layers/borders/useBordersBoundaries';
import type { LiveAircraftStatus } from '../layers/aviation/aircraft/useLiveAircraftSocket';
import type { SpaceSatellitesStatus } from '../layers/space/satellites/satelliteTypes';
import { SatelliteFilters, SAFE_RENDER_CAP } from '../layers/space/satellites/satelliteFilters';
import type { EnergyFilters } from '../layers/energy/infrastructure/energyInfrastructureTypes';

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  preloadStatus?: string;
}

interface LayerPanelProps {
  aviationLayerActive: boolean;
  setAviationLayerActive: (active: boolean) => void;
  aviationStats: AviationStats;
  aviationFilters: AviationFilters;
  onFiltersChange: (filters: AviationFilters) => void;
  earthEventsLayerActive: boolean;
  setEarthEventsLayerActive: (active: boolean) => void;
  earthEventsPhase: EarthEventsPhase;
  bordersLayerActive: boolean;
  setBordersLayerActive: (active: boolean) => void;
  bordersPhase: BordersPhase;
  liveAircraftLayerActive: boolean;
  setLiveAircraftLayerActive: (active: boolean) => void;
  liveAircraftPhase: LiveAircraftStatus;
  spaceSatellitesLayerActive: boolean;
  setSpaceSatellitesLayerActive: (active: boolean) => void;
  spaceSatellitesStatus: SpaceSatellitesStatus;
  spaceSatelliteFilters: SatelliteFilters;
  onSpaceFiltersChange: (filters: SatelliteFilters) => void;
  energyInfrastructureLayerActive: boolean;
  setEnergyInfrastructureLayerActive: (active: boolean) => void;
  energyInfrastructureFilters: EnergyFilters;
  onEnergyFiltersChange: (filters: EnergyFilters) => void;
  maritimeLayerActive: boolean;
  setMaritimeLayerActive: (active: boolean) => void;
  maritimeStats: MaritimeStatsResponse | null;
  maritimeFilters: { search: string; vesselType: string | null };
  onMaritimeFiltersChange: (filters: { search: string; vesselType: string | null }) => void;
  onMaritimeRefresh: () => void;
}

const FILTER_KEYS: (keyof AviationFilters)[] = [
  'major', 'regional', 'local', 'heliport', 'seaplane', 'balloonport', 'unknown', 'closed',
];

function statusLabel(entry: LayerRegistryEntry): string {
  if (entry.status === 'active') return 'ACTIVE';
  if (entry.status === 'coming_soon') return 'COMING SOON';
  return 'NO DATA YET';
}

const LayerPanel: React.FC<LayerPanelProps> = ({
  aviationLayerActive, setAviationLayerActive,
  aviationStats, aviationFilters, onFiltersChange,
  earthEventsLayerActive, setEarthEventsLayerActive, earthEventsPhase,
  bordersLayerActive, setBordersLayerActive, bordersPhase,
  liveAircraftLayerActive, setLiveAircraftLayerActive, liveAircraftPhase,
  spaceSatellitesLayerActive, setSpaceSatellitesLayerActive, spaceSatellitesStatus,
  spaceSatelliteFilters, onSpaceFiltersChange,
  energyInfrastructureLayerActive, setEnergyInfrastructureLayerActive, energyInfrastructureFilters, onEnergyFiltersChange,
  maritimeLayerActive, setMaritimeLayerActive, maritimeStats, maritimeFilters, onMaritimeFiltersChange, onMaritimeRefresh,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { layers, apiAvailable, loading } = useLayerRegistry();

  const toggleFilter = (key: keyof AviationFilters) =>
    onFiltersChange({ ...aviationFilters, [key]: !aviationFilters[key] });

  const toggleSpaceFilter = (key: keyof SatelliteFilters, value?: unknown) => {
    if (value !== undefined) {
      onSpaceFiltersChange({ ...spaceSatelliteFilters, [key]: value });
    } else {
      onSpaceFiltersChange({ ...spaceSatelliteFilters, [key]: !(spaceSatelliteFilters as any)[key] });
    }
  };

  function earthEventsStatusText(): string {
    if (!earthEventsLayerActive) return 'READY — CLICK TO ACTIVATE';
    switch (earthEventsPhase.phase) {
      case 'loading': return 'LOADING...';
      case 'ok': return `ACTIVE — ${earthEventsPhase.events.length} EVENTS`;
      case 'empty': return 'ACTIVE — NO DATA';
      case 'error': return 'ERROR — LAYER OFFLINE';
      default: return 'ACTIVE';
    }
  }

  function bordersStatusText(): string {
    if (!bordersLayerActive) return 'READY — CLICK TO ACTIVATE';
    switch (bordersPhase.phase) {
      case 'loading': return 'LOADING...';
      case 'ok': return `ACTIVE — ${bordersPhase.data.features.length} COUNTRIES`;
      case 'error': return 'ERROR — LAYER OFFLINE';
      default: return 'ACTIVE';
    }
  }

  function liveAircraftStatusText(): string {
    if (!liveAircraftLayerActive) return 'READY — CLICK TO ACTIVATE';
    const { phase, renderedCount, totalReceived, lastSuccessAt, errorMessage } = liveAircraftPhase;
    const secs = lastSuccessAt > 0 ? Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000)) : null;
    const ago = secs !== null ? ` (${secs}s AGO)` : '';
    switch (phase) {
      case 'connecting': return 'CONNECTING — LIVE AIRCRAFT';
      case 'reconnecting':
        return renderedCount > 0
          ? `RECONNECTING — SHOWING LAST SNAPSHOT FROM ${secs ?? '?'}s AGO`
          : 'RECONNECTING...';
      case 'live':
        if (totalReceived > renderedCount && renderedCount > 0) {
          return `LIVE — ${renderedCount} / ${totalReceived} AIRCRAFT RENDERED${ago}`;
        }
        return `LIVE — ${renderedCount} AIRCRAFT${ago}`;
      case 'empty': return `LIVE — NO AIRCRAFT IN VIEW${ago}`;
      case 'error':
        return renderedCount > 0
          ? `API UNAVAILABLE — SHOWING LAST GOOD SNAPSHOT FROM ${secs ?? '?'}s AGO`
          : `API UNAVAILABLE — ${errorMessage}`;
      default: return 'ACTIVE';
    }
  }

  function spaceSatellitesStatusText(): string {
    if (!spaceSatellitesLayerActive) return 'READY — CLICK TO ACTIVATE';
    const { phase, count, lastSuccessAt, errorMessage } = spaceSatellitesStatus;
    const secs = lastSuccessAt > 0 ? Math.max(0, Math.round((Date.now() - lastSuccessAt) / 1000)) : null;
    const ago = secs !== null ? ` (${secs}s AGO)` : '';
    switch (phase) {
      case 'connecting': return 'CONNECTING — SPACE & SATELLITES';
      case 'reconnecting': return count > 0 ? `RECONNECTING — ${count} OBJECTS${ago}` : 'RECONNECTING...';
      case 'live': return `LIVE — ${count.toLocaleString()} OBJECTS${ago}`;
      case 'error': return count > 0 ? `ERROR — LAST SNAPSHOT ${count} OBJECTS${ago}` : `ERROR — ${errorMessage}`;
      default: return 'ACTIVE';
    }
  }

  return (
    <aside className={`shell-panel shell-panel-left shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>Operations</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '»' : '«'}
        </button>
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
            const isGlobeCore = entry.layerId === 'layer_00_globe_core';
            const isAviation = entry.layerId === 'layer_01_aviation';
            const isBorders = entry.layerId === 'layer_02_borders_boundaries';
            const isEarthEvents = entry.layerId === 'layer_03_earth_events';
            const isInactive = entry.status !== 'active';
            const layerIndex = entry.layerId.match(/layer_(\d+)/)?.[1] ?? '';
            
            // Check for energy infrastructure layer
            const isEnergyInfrastructure = entry.layerId === 'layer_10_energy_infrastructure';

            if (isGlobeCore) {
              return (
                <div key={entry.layerId} className="layer-item active" style={{ cursor: 'default' }}>
                  <div className="layer-name">{entry.name} [L0]</div>
                  <div className="layer-status" style={{ opacity: 0.8 }}>ONLINE — ACTIVE</div>
                </div>
              );
            }

            if (isAviation) {
              return (
                <React.Fragment key={entry.layerId}>
                <div className={`layer-item ${aviationLayerActive ? 'active' : ''}`}
                  onClick={() => setAviationLayerActive(!aviationLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L1]</div>
                  <div className="layer-status">
                    {aviationLayerActive ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--shell-accent)', fontWeight: 600 }}>ACTIVE — RESIDENT GLOBAL</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', opacity: 0.8 }}>
                          <span>LOADED: {aviationStats.loaded.toLocaleString()}</span>
                          <span>VISIBLE: {aviationStats.visible.toLocaleString()}</span>
                        </div>
                        {aviationStats.preloadStatus && (
                          <div style={{ fontSize: '0.6rem', opacity: 0.7, marginTop: '2px' }}>
                            STATUS: {aviationStats.preloadStatus}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ opacity: 0.7 }}>READY — CLICK TO ACTIVATE</span>
                    )}
                  </div>
                </div>
                <div className={`layer-item ${liveAircraftLayerActive ? 'active' : ''}`}
                  onClick={() => setLiveAircraftLayerActive(!liveAircraftLayerActive)}
                  style={{ cursor: 'pointer', marginLeft: '10px' }}>
                  <div className="layer-name">↳ Live Aircraft [L1]</div>
                  <div className="layer-status">
                    <span style={{
                      color: liveAircraftLayerActive
                        ? (liveAircraftPhase.phase === 'error' ? '#ff4d4d' : 'var(--shell-accent)')
                        : undefined,
                      fontWeight: liveAircraftLayerActive ? 600 : undefined,
                      opacity: liveAircraftLayerActive ? 1 : 0.7,
                    }}>
                      {liveAircraftStatusText()}
                    </span>
                  </div>
                  {liveAircraftLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Live aircraft data: Airplanes.live (non-commercial/no-SLA). Not complete global coverage.
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            }

            if (isBorders) {
              return (
                <div key={entry.layerId} className={`layer-item ${bordersLayerActive ? 'active' : ''}`}
                  onClick={() => setBordersLayerActive(!bordersLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">Borders & Boundaries [L2]</div>
                  <div className="layer-status">
                    <span style={{
                      color: bordersLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: bordersLayerActive ? 600 : undefined,
                      opacity: bordersLayerActive ? 1 : 0.7,
                    }}>
                      {bordersStatusText()}
                    </span>
                  </div>
                  {bordersLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Natural Earth MVP/local/dev boundaries. Not production-approved. Not Survey of India compliant.
                    </div>
                  )}
                </div>
              );
            }

            if (isEarthEvents) {
              return (
                <div key={entry.layerId} className={`layer-item ${earthEventsLayerActive ? 'active' : ''}`}
                  onClick={() => setEarthEventsLayerActive(!earthEventsLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L3]</div>
                  <div className="layer-status">
                    <span style={{
                      color: earthEventsLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: earthEventsLayerActive ? 600 : undefined,
                      opacity: earthEventsLayerActive ? 1 : 0.7,
                    }}>
                      {earthEventsStatusText()}
                    </span>
                  </div>
                </div>
              );
            }

            const isSpaceSatellites = entry.layerId === 'layer_05_space_satellites';
            if (isSpaceSatellites) {
              return (
                <div key={entry.layerId} className={`layer-item ${spaceSatellitesLayerActive ? 'active' : ''}`}
                  onClick={() => setSpaceSatellitesLayerActive(!spaceSatellitesLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">Space & Satellites [L5]</div>
                  <div className="layer-status">
                    <span style={{
                      color: spaceSatellitesLayerActive
                        ? (spaceSatellitesStatus.phase === 'error' ? '#ff4d4d' : 'var(--shell-accent)')
                        : undefined,
                      fontWeight: spaceSatellitesLayerActive ? 600 : undefined,
                      opacity: spaceSatellitesLayerActive ? 1 : 0.7,
                    }}>
                      {spaceSatellitesStatusText()}
                    </span>
                  </div>
                </div>
              );
            }
            
            const isMaritime = entry.layerId === 'layer_06_maritime';

            if (isMaritime) {
              return (
                <div key={entry.layerId} className={`layer-item ${maritimeLayerActive ? 'active' : ''}`}
                  onClick={() => setMaritimeLayerActive(!maritimeLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L6]</div>
                  <div className="layer-status">
                    <span style={{
                      color: maritimeLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: maritimeLayerActive ? 600 : undefined,
                      opacity: maritimeLayerActive ? 1 : 0.7,
                    }}>
                      {maritimeLayerActive ? 'ACTIVE' : 'READY — CLICK TO ACTIVATE'}
                    </span>
                  </div>
                  {maritimeLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Live vessel data via AISStream. REST polling (30s).
                    </div>
                  )}
                </div>
              );
            }

            // Handle energy infrastructure layer
            if (isEnergyInfrastructure) {
              return (
                <div key={entry.layerId} className={`layer-item ${energyInfrastructureLayerActive ? 'active' : ''}`}
                  onClick={() => setEnergyInfrastructureLayerActive(!energyInfrastructureLayerActive)} style={{ cursor: 'pointer' }}>
                  <div className="layer-name">{entry.name} [L10]</div>
                  <div className="layer-status">
                    <span style={{
                      color: energyInfrastructureLayerActive ? 'var(--shell-accent)' : undefined,
                      fontWeight: energyInfrastructureLayerActive ? 600 : undefined,
                      opacity: energyInfrastructureLayerActive ? 1 : 0.7,
                    }}>
                      {energyInfrastructureLayerActive ? 'ACTIVE' : 'READY — CLICK TO ACTIVATE'}
                    </span>
                  </div>
                  {energyInfrastructureLayerActive && (
                    <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>
                      Static public-source infrastructure data. Not live operational status.
                    </div>
                  )}
                </div>
              );
            }

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

          {aviationLayerActive && (
            <>
              <div className="filter-section">
                <div className="filter-section-header">MARKER FILTERS</div>
                {FILTER_KEYS.map((key) => {
                  const info = AVIATION_CATEGORIES[key];
                  const active = aviationFilters[key];
                  return (
                    <div key={key} className={`filter-toggle ${active ? 'active' : ''}`} onClick={() => toggleFilter(key)}>
                      <span className="filter-toggle-dot"
                        style={{ background: active ? info.markerColor : info.dimColor, opacity: active ? 1 : 0.4 }} />
                      <span className="filter-toggle-label">{info.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="legend-section">
                <div className="legend-section-header">MARKER LEGEND</div>
                {FILTER_KEYS.map((key) => {
                  const info = AVIATION_CATEGORIES[key];
                  return (
                    <div key={key} className="legend-item">
                      <span style={{
                        display: 'inline-block', width: '10px', height: '10px',
                        borderRadius: '50%', background: info.color,
                        marginRight: '8px', verticalAlign: 'middle', opacity: 0.8,
                      }} />
                      <span className="legend-label">{info.label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {spaceSatellitesLayerActive && (
            <>
              <div className="filter-section">
                <div className="filter-section-header">SPACE FILTERS</div>
                <div
                  className={`filter-toggle ${spaceSatelliteFilters.extremeMode ? 'active' : ''}`}
                  onClick={() => toggleSpaceFilter('extremeMode')}
                  style={{ marginBottom: '4px' }}
                >
                  <span className="filter-toggle-dot"
                    style={{ background: spaceSatelliteFilters.extremeMode ? '#ff4d4d' : '#555', opacity: spaceSatelliteFilters.extremeMode ? 1 : 0.4 }} />
                  <span className="filter-toggle-label" style={{ color: spaceSatelliteFilters.extremeMode ? '#ff4d4d' : undefined }}>
                    {spaceSatelliteFilters.extremeMode ? 'ALL OBJECTS ON' : 'Show all objects'}
                  </span>
                </div>
                {spaceSatelliteFilters.extremeMode && (
                  <div style={{ fontSize: '0.48rem', color: '#ff6b6b', lineHeight: 1.3, marginBottom: '6px', paddingLeft: '18px' }}>
                    Extreme mode may reduce FPS or crash slower browsers.
                  </div>
                )}
                {!spaceSatelliteFilters.extremeMode && (
                  <div style={{ fontSize: '0.48rem', color: '#ffab00', opacity: 0.65, lineHeight: 1.3, marginBottom: '6px', paddingLeft: '18px' }}>
                    Default: capped to {SAFE_RENDER_CAP.toLocaleString()} objects.
                  </div>
                )}

                {[
                  { key: 'showSatellites' as const, label: 'Satellites / Payloads', color: '#00e5ff' },
                  { key: 'showDebris' as const, label: 'Debris', color: '#ff6b35' },
                  { key: 'showRocketBodies' as const, label: 'Rocket Bodies', color: '#ffd166' },
                  { key: 'showInactive' as const, label: 'Inactive Objects', color: '#a8dadc' },
                  { key: 'importantOnly' as const, label: 'Important Only', color: '#ff2d55' },
                  { key: 'showStarlink' as const, label: 'Starlink', color: '#00e676' },
                ].map(({ key, label, color }) => {
                  const active = key === 'importantOnly'
                    ? spaceSatelliteFilters.importantOnly
                    : key === 'showStarlink'
                      ? spaceSatelliteFilters.showStarlink
                      : (spaceSatelliteFilters as any)[key];
                  return (
                    <div key={key} className={`filter-toggle ${active ? 'active' : ''}`}
                      onClick={() => toggleSpaceFilter(key)}>
                      <span className="filter-toggle-dot"
                        style={{ background: active ? color : '#555', opacity: active ? 1 : 0.4 }} />
                      <span className="filter-toggle-label">{label}</span>
                    </div>
                  );
                })}

                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>SOURCE</div>
                  {([
                    { value: 'all' as const, label: 'All' },
                    { value: 'celestrak' as const, label: 'CelesTrak' },
                    { value: 'space-track' as const, label: 'Space-Track' },
                  ]).map(({ value, label }) => (
                    <div key={value}
                      className={`filter-toggle ${spaceSatelliteFilters.sourceFilter === value ? 'active' : ''}`}
                      onClick={() => toggleSpaceFilter('sourceFilter', value)}>
                      <span className="filter-toggle-dot"
                        style={{ background: spaceSatelliteFilters.sourceFilter === value ? '#8a2be2' : '#555',
                          opacity: spaceSatelliteFilters.sourceFilter === value ? 1 : 0.4 }} />
                      <span className="filter-toggle-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              </>
            )}
            
            {/* Energy Infrastructure Layer Filters */}
            {energyInfrastructureLayerActive && (
              <>
                <div className="filter-section">
                  <div className="filter-section-header">ENERGY FILTERS</div>
                  
                  {/* Feature Type Filter */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>FEATURE TYPE</div>
                    {([
                      { value: null, label: 'All' },
                      { value: 'power_plant', label: 'Power Plant' },
                      { value: 'substation', label: 'Substation' },
                      { value: 'transmission_line', label: 'Transmission Line' },
                      { value: 'oil_pipeline', label: 'Oil Pipeline' },
                      { value: 'gas_pipeline', label: 'Gas Pipeline' },
                    ]).map(({ value, label }) => (
                      <div key={value ?? 'all'}
                        className={`filter-toggle ${energyInfrastructureFilters.featureType === value ? 'active' : ''}`}
                        onClick={() => onEnergyFiltersChange({ ...energyInfrastructureFilters, featureType: value })}>
                        <span className="filter-toggle-dot"
                          style={{ background: energyInfrastructureFilters.featureType === value ? '#90ee90' : '#555',
                            opacity: energyInfrastructureFilters.featureType === value ? 1 : 0.4 }} />
                        <span className="filter-toggle-label">{label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Fuel Type Filter */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>FUEL TYPE</div>
                    {([
                      { value: null, label: 'All' },
                      { value: 'nuclear', label: 'Nuclear', color: '#ff8c00' },
                      { value: 'coal', label: 'Coal', color: '#8b0000' },
                      { value: 'gas', label: 'Gas', color: '#ffa500' },
                      { value: 'oil', label: 'Oil', color: '#8b4513' },
                      { value: 'hydro', label: 'Hydro', color: '#4169e1' },
                      { value: 'solar', label: 'Solar', color: '#ffff00' },
                      { value: 'wind', label: 'Wind', color: '#90ee90' },
                      { value: 'biomass', label: 'Biomass/Other', color: '#556b2f' },
                    ]).map(({ value, label, color }) => (
                      <div key={value ?? 'all'}
                        className={`filter-toggle ${energyInfrastructureFilters.fuelType === value ? 'active' : ''}`}
                        onClick={() => onEnergyFiltersChange({ ...energyInfrastructureFilters, fuelType: value })}>
                        <span className="filter-toggle-dot"
                          style={{ background: energyInfrastructureFilters.fuelType === value ? (color || '#90ee90') : '#555',
                            opacity: energyInfrastructureFilters.fuelType === value ? 1 : 0.4 }} />
                        <span className="filter-toggle-label">{label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Country Filter */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>COUNTRY</div>
                    <input
                      type="text"
                      placeholder="Filter by country..."
                      value={energyInfrastructureFilters.country || ''}
                      onChange={(e) => onEnergyFiltersChange({ ...energyInfrastructureFilters, country: e.target.value || null })}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '3px',
                        color: 'var(--shell-text-dim)',
                        padding: '4px 8px',
                        fontSize: '0.6rem',
                        marginBottom: '4px'
                      }}
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>STATUS</div>
                    {([
                      { value: null, label: 'All' },
                      { value: 'operational', label: 'Operational' },
                      { value: 'planned', label: 'Planned' },
                      { value: 'decommissioned', label: 'Decommissioned' },
                    ]).map(({ value, label }) => (
                      <div key={value ?? 'all'}
                        className={`filter-toggle ${energyInfrastructureFilters.status === value ? 'active' : ''}`}
                        onClick={() => onEnergyFiltersChange({ ...energyInfrastructureFilters, status: value })}>
                        <span className="filter-toggle-dot"
                          style={{ background: energyInfrastructureFilters.status === value ? '#90ee90' : '#555',
                            opacity: energyInfrastructureFilters.status === value ? 1 : 0.4 }} />
                        <span className="filter-toggle-label">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="legend-section">
                  <div className="legend-section-header">ENERGY LEGEND</div>
                  
                  {/* Power Plant Colors */}
                  <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>POWER PLANTS</div>
                  {([
                    { color: '#ff8c00', label: 'Nuclear' },
                    { color: '#8b0000', label: 'Coal' },
                    { color: '#ffa500', label: 'Gas' },
                    { color: '#8b4513', label: 'Oil' },
                    { color: '#4169e1', label: 'Hydro' },
                    { color: '#ffff00', label: 'Solar' },
                    { color: '#90ee90', label: 'Wind' },
                    { color: '#556b2f', label: 'Biomass/Other' },
                  ]).map(({ color, label }) => (
                    <div key={label} className="legend-item">
                      <span style={{
                        display: 'inline-block', width: '10px', height: '10px',
                        borderRadius: '50%', background: color,
                        marginRight: '8px', verticalAlign: 'middle', opacity: 0.8,
                      }} />
                      <span className="legend-label">{label}</span>
                    </div>
                  ))}
                  
                  {/* Infrastructure Types */}
                  <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px', marginTop: '4px' }}>INFRASTRUCTURE</div>
                  {[
                    { color: '#800080', label: 'Substation', shape: 'diamond' },
                    { color: '#87cefa', label: 'Transmission Line', shape: 'dashed' },
                    { color: '#ff0000', label: 'Oil Pipeline', shape: 'solid' },
                    { color: '#ffa500', label: 'Gas Pipeline', shape: 'solid' },
                  ].map(({ color, label, shape }) => (
                    <div key={label} className="legend-item">
                      <span style={{
                        display: 'inline-block', width: '10px', height: '10px',
                        background: color,
                        marginRight: '8px', verticalAlign: 'middle', opacity: 0.8,
                        ...(shape === 'diamond' ? { transform: 'rotate(45deg)' } : {}),
                        ...(shape === 'dashed' ? { borderStyle: 'dashed' } : {})
                      }} />
                      <span className="legend-label">{label}</span>
                    </div>
                  ))}
                  
                  <div style={{ fontSize: '0.48rem', color: '#ffab00', opacity: 0.65, marginTop: '6px', lineHeight: 1.4 }}>
                    Static public-source infrastructure data. Not live operational status.
                  </div>
                </div>
              </>
            )}

            {maritimeLayerActive && (
              <>
                <div className="filter-section">
                  <div className="filter-section-header">MARITIME CONTROLS</div>

                  {/* Search */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>SEARCH VESSEL</div>
                    <input
                      type="text"
                      placeholder="Search name, MMSI, callsign..."
                      value={maritimeFilters.search || ''}
                      onChange={(e) => onMaritimeFiltersChange({ ...maritimeFilters, search: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '3px',
                        color: 'var(--shell-text-dim)',
                        padding: '4px 8px',
                        fontSize: '0.6rem',
                        marginBottom: '4px'
                      }}
                    />
                  </div>

                  {/* Vessel Type dropdown */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>VESSEL TYPE</div>
                    <select
                      value={maritimeFilters.vesselType || ''}
                      onChange={(e) => onMaritimeFiltersChange({ ...maritimeFilters, vesselType: e.target.value || null })}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '3px',
                        color: 'var(--shell-text-dim)',
                        padding: '4px 8px',
                        fontSize: '0.6rem',
                        marginBottom: '4px',
                        outline: 'none'
                      }}
                    >
                      <option value="">All Types</option>
                      <option value="cargo">Cargo</option>
                      <option value="tanker">Tanker</option>
                      <option value="passenger">Passenger</option>
                      <option value="fishing">Fishing</option>
                      <option value="tug">Tug</option>
                      <option value="military">Military</option>
                      <option value="pleasure">Pleasure</option>
                      <option value="sailing">Sailing</option>
                      <option value="high speed craft">High Speed Craft</option>
                    </select>
                  </div>

                  {/* Refresh button */}
                  <button
                    onClick={onMaritimeRefresh}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '3px',
                      color: 'var(--shell-text-dim)',
                      padding: '4px 8px',
                      fontSize: '0.6rem',
                      cursor: 'pointer',
                      marginTop: '6px',
                      textAlign: 'center'
                    }}
                  >
                    Refresh Data
                  </button>
                </div>

                {/* Stats Section */}
                {maritimeStats && (
                  <div className="legend-section" style={{ marginTop: '10px' }}>
                    <div className="legend-section-header">MARITIME STATS</div>
                    <div style={{ fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)' }}>
                      <div>Total Vessels: {maritimeStats.totalVessels}</div>
                      <div>Active: {maritimeStats.activeVessels}</div>
                      <div>Stale: {maritimeStats.staleVessels}</div>
                      {maritimeStats.lastUpdated && (
                        <div style={{ fontSize: '0.5rem', opacity: 0.6, marginTop: '4px' }}>
                          Updated: {new Date(maritimeStats.lastUpdated).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Legend Section */}
                <div className="legend-section">
                  <div className="legend-section-header">VESSEL TYPES</div>
                  {[
                    { color: '#3b82f6', label: 'Cargo' },
                    { color: '#f97316', label: 'Tanker' },
                    { color: '#a855f7', label: 'Passenger' },
                    { color: '#22c55e', label: 'Fishing' },
                    { color: '#eab308', label: 'Tug' },
                    { color: '#ef4444', label: 'Military' },
                    { color: '#06b6d4', label: 'Pleasure / Sailing' },
                    { color: '#00e5ff', label: 'High Speed Craft' },
                    { color: '#9ca3af', label: 'Unknown' },
                  ].map(({ color, label }) => (
                    <div key={label} className="legend-item">
                      <span style={{
                        display: 'inline-block', width: '8px', height: '8px',
                        borderRadius: '50%', background: color,
                        marginRight: '8px', verticalAlign: 'middle', opacity: 0.8,
                      }} />
                      <span className="legend-label">{label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      )}
    </aside>
  );
};

export default LayerPanel;
