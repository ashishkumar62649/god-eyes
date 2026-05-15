import React from 'react';

interface IntelSectionProps {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const IntelSection: React.FC<IntelSectionProps> = ({ 
  title, 
  children, 
  collapsible = false,
  defaultOpen = true 
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="intel-section" style={{ marginBottom: '24px' }}>
      <div 
        className="intel-section-header"
        onClick={() => collapsible && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: collapsible ? 'pointer' : 'default',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          paddingBottom: '8px',
          marginBottom: '12px'
        }}
      >
        <span style={{ 
          fontSize: '0.65rem', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '2px',
          color: 'var(--shell-text-dim)'
        }}>
          {title}
        </span>
        {collapsible && (
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>
            {isOpen ? '−' : '+'}
          </span>
        )}
      </div>
      {isOpen && (
        <div className="intel-section-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default IntelSection;
