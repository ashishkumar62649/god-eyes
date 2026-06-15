import type { EnergyFeature } from '../../layers/energy/infrastructure/energyInfrastructureTypes';

export function EnergyDetail({ feature }: { feature: EnergyFeature }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {feature.name || 'Unnamed Energy Feature'}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        {feature.featureType.replace('_', ' ').toUpperCase()}
        {feature.fuelType ? ` · ${feature.fuelType.toUpperCase()}` : ''}
      </div>

      <div className="detail-row"><div className="detail-label">Type</div><div className="detail-value">{feature.featureType.replace('_', ' ')}</div></div>
      {feature.fuelType && <div className="detail-row"><div className="detail-label">Fuel Type</div><div className="detail-value">{feature.fuelType}</div></div>}
      {feature.capacityMw && <div className="detail-row"><div className="detail-label">Capacity</div><div className="detail-value">{feature.capacityMw.toLocaleString()} MW</div></div>}
      {feature.voltageKv && <div className="detail-row"><div className="detail-label">Voltage</div><div className="detail-value">{feature.voltageKv.toLocaleString()} kV</div></div>}
      {feature.operator && <div className="detail-row"><div className="detail-label">Operator</div><div className="detail-value">{feature.operator}</div></div>}
      {feature.owner && <div className="detail-row"><div className="detail-label">Owner</div><div className="detail-value">{feature.owner}</div></div>}
      {feature.country && <div className="detail-row"><div className="detail-label">Country</div><div className="detail-value">{feature.country}</div></div>}
      {feature.status && <div className="detail-row"><div className="detail-label">Status</div><div className="detail-value">{feature.status}</div></div>}
      {feature.pipelineProduct && <div className="detail-row"><div className="detail-label">Pipeline Product</div><div className="detail-value">{feature.pipelineProduct}</div></div>}
      {feature.pipelineLengthKm && <div className="detail-row"><div className="detail-label">Pipeline Length</div><div className="detail-value">{feature.pipelineLengthKm.toLocaleString()} km</div></div>}
      {feature.terminalType && <div className="detail-row"><div className="detail-label">Terminal Type</div><div className="detail-value">{feature.terminalType}</div></div>}

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, marginBottom: '6px', color: 'var(--shell-accent)' }}>SOURCE & PROVENANCE</div>
        <div className="detail-row"><div className="detail-label">Source ID</div><div className="detail-value">{feature.sourceId}</div></div>
        <div className="detail-row"><div className="detail-label">Source Confidence</div><div className="detail-value">{feature.sourceConfidence}</div></div>
        {feature.sourceUpdatedAt && <div className="detail-row"><div className="detail-label">Source Updated</div><div className="detail-value">{new Date(feature.sourceUpdatedAt).toLocaleDateString()}</div></div>}
        {feature.firstSeenAt && <div className="detail-row"><div className="detail-label">First Seen</div><div className="detail-value">{new Date(feature.firstSeenAt).toLocaleDateString()}</div></div>}
        {feature.lastSeenAt && <div className="detail-row"><div className="detail-label">Last Seen</div><div className="detail-value">{new Date(feature.lastSeenAt).toLocaleDateString()}</div></div>}
      </div>

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', opacity: 0.6, fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)' }}>
        Static public-source infrastructure data. Not live operational status.
      </div>
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem', fontFamily: 'var(--shell-font-mono)' }}>
        SYSTEM ID: {feature.id}
      </div>
    </div>
  );
}
