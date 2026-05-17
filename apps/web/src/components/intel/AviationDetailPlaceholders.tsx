import React from 'react';
import IntelSection from './IntelSection';

const PlaceholderItem: React.FC = () => (
  <div style={{ 
    padding: '12px', 
    border: '1px dashed rgba(255, 255, 255, 0.1)', 
    borderRadius: '4px',
    fontSize: '0.65rem',
    color: 'var(--shell-text-dim)',
    textAlign: 'center',
    letterSpacing: '1px'
  }}>
    PENDING DETAIL API
  </div>
);

const AviationDetailPlaceholders: React.FC = () => {
  return (
    <>
      <IntelSection title="Runways" collapsible defaultOpen={false}>
        <PlaceholderItem />
      </IntelSection>

      <IntelSection title="Frequencies" collapsible defaultOpen={false}>
        <PlaceholderItem />
      </IntelSection>

      <IntelSection title="Nearby Navaids" collapsible defaultOpen={false}>
        <PlaceholderItem />
      </IntelSection>

      <IntelSection title="Data Quality / Provenance" collapsible defaultOpen={false}>
        <PlaceholderItem />
      </IntelSection>
    </>
  );
};

export default AviationDetailPlaceholders;
