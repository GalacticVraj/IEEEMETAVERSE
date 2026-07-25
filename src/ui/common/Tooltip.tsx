import { useState, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  readonly content: ReactNode;
  readonly title?: string | undefined;
  readonly position?: 'top' | 'bottom' | 'left' | 'right' | undefined;
  readonly children: ReactNode;
  readonly disabled?: boolean | undefined;
}

export function Tooltip({
  content,
  title,
  position = 'top',
  children,
  disabled = false,
}: TooltipProps): ReactElement {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (disabled) {
    return <>{children}</>;
  }

  const handleMouseEnter = (): void => {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, 150);
  };

  const handleMouseLeave = (): void => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  };

  const getPositionStyle = (): React.CSSProperties => {
    switch (position) {
      case 'bottom':
        return { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' };
      case 'left':
        return { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' };
      case 'top':
      default:
        return { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          className="animate-scale-in"
          style={{
            position: 'absolute',
            ...getPositionStyle(),
            zIndex: 100,
            pointerEvents: 'none',
            background: 'rgba(24, 32, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            color: '#FAFAF7',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
            whiteSpace: 'nowrap',
            fontSize: 11,
            lineHeight: 1.35,
            maxWidth: 260,
          }}
        >
          {title && (
            <div
              style={{
                fontWeight: 700,
                color: '#38BDF8',
                marginBottom: 2,
                fontSize: 10,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </div>
          )}
          <div style={{ color: '#E2E8F0', whiteSpace: 'normal' }}>{content}</div>
        </div>
      )}
    </div>
  );
}
