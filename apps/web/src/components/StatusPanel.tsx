import React, { useState } from 'react';
import type { BordersPhase } from '../layers/layer_02_borders_boundaries/useBordersBoundaries';
import type { EarthEventsPhase } from '../layers/layer_03_earth_events/useEarthEvents';
import type { LiveAircraftStatus } from '../layers/layer_01_aviation/aircraft/useLiveAircraftSocket';
import type { SpaceSatellitesStatus } from '../layers/layer_05_space_satellites/satellites/satelliteTypes';

interface AviationStats {
  loaded: number;
  visible: number;
  clustersActive: boolean;
  renderMode: string;
  fps: number;
  cacheEntries?: number;
  cacheHits?: number;
  cacheMisses?: number;
  inflight?: number;
  preloadStatus?: string;
  categoryCounts?: Record<string, number>;
}

interface StatusPanelProps {
  aviationLayerActive: boolean;
  aviationStats: AviationStats;
  bordersLayerActive: boolean;
  bordersPhase: BordersPhase;
  earthEventsLayerActive: boolean;
  earthEventsPhase: EarthEventsPhase;
  liveAircraftLayerActive: boolean;
  liveAircraftPhase: LiveAircraftStatus;
  spaceSatellitesLayerActive?: boolean;
  spaceSatellitesStatus?: SpaceSatellitesStatus;
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  aviationLayerActive, aviationStats,
  bordersLayerActive, bordersPhase,
  earthEventsLayerActive, earthEventsPhase,
  liveAircraftLayerActive, liveAircraftPhase,
  spaceSatellitesLayerActive, spaceSatellitesStatus,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeLayers = ['L0'];
  if (aviationLayerActive) activeLayers.push('L1');
  if (bordersLayerActive) activeLayers.push('L2');
  if (earthEventsLayerActive) activeLayers.push('L3');
  if (spaceSatellitesLayerActive) activeLayers.push('L5');

  return (
    <footer className={`shell-panel shell-footer shell-interactive ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="panel-header">
        {!isCollapsed && <span>System Telemetry</span>}
        <button className="panel-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '▲' : '▼'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="panel-content" style={{ display: 'flex', gap: '32px', alignItems: 'center', padding: '16px 20px' }}>
          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Node Status</div>
            <div className="detail-value" style={{ color: 'var(--shell-accent)' }}>CONNECTED</div>
          </div>

          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Active Layers</div>
            <div className="detail-value">{activeLayers.join(' / ')}</div>
          </div>

          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Render Mode</div>
            <div className="detail-value" style={{ color: aviationLayerActive ? 'var(--shell-accent)' : 'inherit' }}>
              {aviationLayerActive ? aviationStats.renderMode : 'IDLE'}
            </div>
          </div>

          {aviationLayerActive && aviationStats.preloadStatus && (
            <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
              <div className="detail-label">Preload</div>
              <div className="detail-value" style={{ color: aviationStats.preloadStatus === 'CACHE_READY' ? '#00e676' : '#ffab00', fontWeight: 600 }}>
                {aviationStats.preloadStatus}
              </div>
            </div>
          )}

          {bordersLayerActive && (
            <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
              <div className="detail-label">Borders</div>
              <div className="detail-value" style={{
                color: bordersPhase.phase === 'ok' ? 'var(--shell-accent)' : bordersPhase.phase === 'error' ? '#ff4d4d' : '#ffab00',
              }}>
                {bordersPhase.phase === 'ok' ? `${bordersPhase.data.features.length} COUNTRIES`
                  : bordersPhase.phase === 'loading' ? 'LOADING...'
                  : bordersPhase.phase === 'error' ? 'ERROR'
                  : 'IDLE'}
              </div>
            </div>
          )}

          {earthEventsLayerActive && (
            <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
              <div className="detail-label">Earth Events</div>
              <div className="detail-value" style={{
                color: earthEventsPhase.phase === 'ok' ? 'var(--shell-accent)' : earthEventsPhase.phase === 'error' ? '#ff4d4d' : '#ffab00',
              }}>
                {earthEventsPhase.phase === 'ok' ? `${earthEventsPhase.events.length} EVENTS`
                  : earthEventsPhase.phase === 'loading' ? 'LOADING...'
                  : earthEventsPhase.phase === 'error' ? 'ERROR'
                  : 'IDLE'}
              </div>
            </div>
          )}

          {liveAircraftLayerActive && (
            <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
              <div className="detail-label">Live Aircraft</div>
              <div className="detail-value" style={{
                color: liveAircraftPhase.phase === 'live' ? 'var(--shell-accent)'
                  : liveAircraftPhase.phase === 'error' ? '#ff4d4d'
                  : '#ffab00',
              }}>
                {liveAircraftPhase.phase === 'live'
                  ? `${liveAircraftPhase.renderedCount} AIRCRAFT`
                  : liveAircraftPhase.phase === 'connecting' ? 'CONNECTING...'
                  : liveAircraftPhase.phase === 'reconnecting' ? 'RECONNECTING...'
                  : liveAircraftPhase.phase === 'empty' ? 'NONE IN VIEW'
                  : liveAircraftPhase.phase === 'error' ? 'UNAVAILABLE'
                  : 'IDLE'}
              </div>
            </div>
          )}

          {spaceSatellitesLayerActive && spaceSatellitesStatus && (
            <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
              <div className="detail-label">Space Objects</div>
              <div className="detail-value" style={{
                color: spaceSatellitesStatus.phase === 'live' ? 'var(--shell-accent)'
                  : spaceSatellitesStatus.phase === 'error' ? '#ff4d4d'
                  : '#ffab00',
              }}>
                {spaceSatellitesStatus.phase === 'live'
                  ? `${spaceSatellitesStatus.count.toLocaleString()} OBJECTS`
                  : spaceSatellitesStatus.phase === 'connecting' ? 'CONNECTING...'
                  : spaceSatellitesStatus.phase === 'reconnecting' ? 'RECONNECTING...'
                  : spaceSatellitesStatus.phase === 'error' ? 'UNAVAILABLE'
                  : 'IDLE'}
              </div>
            </div>
          )}

          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">FPS</div>
            <div className="detail-value" style={{
              color: aviationStats.fps >= 50 ? '#00e676' : aviationStats.fps >= 30 ? '#ffab00' : '#ff4d4d',
              fontWeight: 600,
            }}>
              {aviationStats.fps || '--'}
            </div>
          </div>

          <div className="detail-row" style={{ marginBottom: 0, paddingLeft: 10 }}>
            <div className="detail-label">Data Stream</div>
            <div className="detail-value" style={{ opacity: 0.8 }}>
              {aviationLayerActive ? `L1 [${aviationStats.loaded}]` : 'STANDBY — ENABLE AVIATION LAYER'}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 0.3 : 0.1 }}></div>
            <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 0.6 : 0.3 }}></div>
            <div style={{ width: '4px', height: '14px', background: 'var(--shell-accent)', opacity: aviationLayerActive ? 1.0 : 0.5 }}></div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default StatusPanel;
