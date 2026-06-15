import type { WeatherRenderItem } from '../../layers/layer_07_weather/weatherTypes';
import {
  formatMeasurement,
  formatWindDirection,
  formatTimestamp,
  formatCondition,
} from '../../layers/layer_07_weather/weatherDetail';

export function WeatherDetail({ item }: { item: WeatherRenderItem }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--shell-accent)', lineHeight: 1.2, marginBottom: '2px' }}>
        {formatCondition(item)}
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '10px', fontFamily: 'var(--shell-font-mono)', letterSpacing: '1px' }}>
        WEATHER OBSERVATION
      </div>

      <div className="detail-row"><div className="detail-label">Temperature</div><div className="detail-value">{formatMeasurement(item.temperatureC, '°C')}</div></div>
      {item.apparentTemperatureC !== null && <div className="detail-row"><div className="detail-label">Feels Like</div><div className="detail-value">{formatMeasurement(item.apparentTemperatureC, '°C')}</div></div>}
      {item.humidityPercent !== null && <div className="detail-row"><div className="detail-label">Humidity</div><div className="detail-value">{formatMeasurement(item.humidityPercent, '%', 0)}</div></div>}
      {item.windSpeedKph !== null && <div className="detail-row"><div className="detail-label">Wind Speed</div><div className="detail-value">{formatMeasurement(item.windSpeedKph, 'km/h')}</div></div>}
      {item.windDirectionDeg !== null && <div className="detail-row"><div className="detail-label">Wind Direction</div><div className="detail-value">{formatWindDirection(item.windDirectionDeg)}</div></div>}
      {item.windGustKph !== null && <div className="detail-row"><div className="detail-label">Wind Gusts</div><div className="detail-value">{formatMeasurement(item.windGustKph, 'km/h')}</div></div>}
      {item.precipitationMm !== null && <div className="detail-row"><div className="detail-label">Precipitation</div><div className="detail-value">{formatMeasurement(item.precipitationMm, 'mm')}</div></div>}
      {item.precipitationProbabilityPercent !== null && <div className="detail-row"><div className="detail-label">Precip. Probability</div><div className="detail-value">{formatMeasurement(item.precipitationProbabilityPercent, '%', 0)}</div></div>}
      {item.cloudCoverPercent !== null && <div className="detail-row"><div className="detail-label">Cloud Cover</div><div className="detail-value">{formatMeasurement(item.cloudCoverPercent, '%', 0)}</div></div>}
      {item.pressureHpa !== null && <div className="detail-row"><div className="detail-label">Pressure</div><div className="detail-value">{formatMeasurement(item.pressureHpa, 'hPa')}</div></div>}

      <div className="detail-row"><div className="detail-label">Forecast For</div><div className="detail-value">{formatTimestamp(item.forecastFor)}</div></div>
      <div className="detail-row"><div className="detail-label">Last Updated</div><div className="detail-value">{formatTimestamp(item.fetchedAt)}</div></div>
      {item.isStale && <div className="detail-row"><div className="detail-label">Data Status</div><div className="detail-value" style={{ color: '#ffab00' }}>Stale</div></div>}

      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', fontSize: '0.6rem', lineHeight: 1.5, color: 'var(--shell-text-dim)' }}>
        {item.attribution}
      </div>
      <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', opacity: 0.3, fontSize: '0.6rem', fontFamily: 'var(--shell-font-mono)' }}>
        OBSERVATION ID: {item.observationId}
      </div>
    </div>
  );
}
