import type { EnergyFilters } from '../../layers/layer_10_energy_infrastructure/infrastructure/energyInfrastructureTypes';

export function EnergyControls({
  active, setActive, filters, onFiltersChange, entry,
}: {
  active: boolean;
  setActive: (a: boolean) => void;
  filters: EnergyFilters;
  onFiltersChange: (f: EnergyFilters) => void;
  entry: { name: string };
}) {
  const dotStyle = (isActive: boolean, color?: string) => ({
    background: isActive ? (color || '#90ee90') : '#555', opacity: isActive ? 1 : 0.4,
  });

  return (
    <>
      <div className={`layer-item ${active ? 'active' : ''}`} onClick={() => setActive(!active)} style={{ cursor: 'pointer' }}>
        <div className="layer-name">{entry.name} [L10]</div>
        <div className="layer-status">
          <span style={{ color: active ? 'var(--shell-accent)' : undefined, fontWeight: active ? 600 : undefined, opacity: active ? 1 : 0.7 }}>
            {active ? 'ACTIVE' : 'READY — CLICK TO ACTIVATE'}
          </span>
        </div>
        {active && <div style={{ fontSize: '0.5rem', color: '#ffab00', opacity: 0.65, marginTop: '3px', lineHeight: 1.4 }}>Static public-source infrastructure data. Not live operational status.</div>}
      </div>

      {active && (
        <>
          <div className="filter-section">
            <div className="filter-section-header">ENERGY FILTERS</div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>FEATURE TYPE</div>
              {([
                { value: null, label: 'All' }, { value: 'power_plant', label: 'Power Plant' },
                { value: 'substation', label: 'Substation' }, { value: 'transmission_line', label: 'Transmission Line' },
                { value: 'oil_pipeline', label: 'Oil Pipeline' }, { value: 'gas_pipeline', label: 'Gas Pipeline' },
              ]).map(({ value, label }) => (
                <div key={value ?? 'all'} className={`filter-toggle ${filters.featureType === value ? 'active' : ''}`} onClick={() => onFiltersChange({ ...filters, featureType: value })}>
                  <span className="filter-toggle-dot" style={dotStyle(filters.featureType === value)} />
                  <span className="filter-toggle-label">{label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>FUEL TYPE</div>
              {([
                { value: null, label: 'All' }, { value: 'nuclear', label: 'Nuclear', color: '#ff8c00' },
                { value: 'coal', label: 'Coal', color: '#8b0000' }, { value: 'gas', label: 'Gas', color: '#ffa500' },
                { value: 'oil', label: 'Oil', color: '#8b4513' }, { value: 'hydro', label: 'Hydro', color: '#4169e1' },
                { value: 'solar', label: 'Solar', color: '#ffff00' }, { value: 'wind', label: 'Wind', color: '#90ee90' },
                { value: 'biomass', label: 'Biomass/Other', color: '#556b2f' },
              ]).map(({ value, label, color }) => (
                <div key={value ?? 'all'} className={`filter-toggle ${filters.fuelType === value ? 'active' : ''}`} onClick={() => onFiltersChange({ ...filters, fuelType: value })}>
                  <span className="filter-toggle-dot" style={dotStyle(filters.fuelType === value, color)} />
                  <span className="filter-toggle-label">{label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>COUNTRY</div>
              <input type="text" placeholder="Filter by country..." value={filters.country || ''}
                onChange={(e) => onFiltersChange({ ...filters, country: e.target.value || null })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', color: 'var(--shell-text-dim)', padding: '4px 8px', fontSize: '0.6rem', marginBottom: '4px' }} />
            </div>

            <div style={{ marginTop: '4px' }}>
              <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>STATUS</div>
              {([
                { value: null, label: 'All' }, { value: 'operational', label: 'Operational' },
                { value: 'planned', label: 'Planned' }, { value: 'decommissioned', label: 'Decommissioned' },
              ]).map(({ value, label }) => (
                <div key={value ?? 'all'} className={`filter-toggle ${filters.status === value ? 'active' : ''}`} onClick={() => onFiltersChange({ ...filters, status: value })}>
                  <span className="filter-toggle-dot" style={dotStyle(filters.status === value)} />
                  <span className="filter-toggle-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-section-header">ENERGY LEGEND</div>
            <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px' }}>POWER PLANTS</div>
            {([
              { color: '#ff8c00', label: 'Nuclear' }, { color: '#8b0000', label: 'Coal' }, { color: '#ffa500', label: 'Gas' },
              { color: '#8b4513', label: 'Oil' }, { color: '#4169e1', label: 'Hydro' }, { color: '#ffff00', label: 'Solar' },
              { color: '#90ee90', label: 'Wind' }, { color: '#556b2f', label: 'Biomass/Other' },
            ]).map(({ color, label }) => (
              <div key={label} className="legend-item">
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.8 }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
            <div style={{ fontSize: '0.48rem', color: '#888', marginBottom: '2px', marginTop: '4px' }}>INFRASTRUCTURE</div>
            {[
              { color: '#800080', label: 'Substation' }, { color: '#87cefa', label: 'Transmission Line' },
              { color: '#ff0000', label: 'Oil Pipeline' }, { color: '#ffa500', label: 'Gas Pipeline' },
            ].map(({ color, label }) => (
              <div key={label} className="legend-item">
                <span style={{ display: 'inline-block', width: '10px', height: '10px', background: color, marginRight: '8px', verticalAlign: 'middle', opacity: 0.8 }} />
                <span className="legend-label">{label}</span>
              </div>
            ))}
            <div style={{ fontSize: '0.48rem', color: '#ffab00', opacity: 0.65, marginTop: '6px', lineHeight: 1.4 }}>
              Static public-source infrastructure data. Not live operational status.
            </div>
          </div>
        </>
      )}
    </>
  );
}
