import type { ReactElement, ReactNode } from 'react';

export interface PanelHeaderProps {
  readonly title: string;
  readonly subtitle: string;
  readonly icon: ReactNode;
  readonly action?: ReactNode;
}

export function PanelHeader({ title, subtitle, icon, action }: PanelHeaderProps): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
        paddingBottom: 10,
        marginBottom: 10,
        borderBottom: '1px solid rgba(211, 215, 210, 0.7)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 4,
            background: 'rgba(34, 99, 126, 0.08)',
            color: '#22637E',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="console-section-title"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#1C2530',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#5A6774',
              lineHeight: 1.2,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
