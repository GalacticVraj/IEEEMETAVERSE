/**
 * ShareResultCard — the "I actually did this" artefact.
 *
 * Renders the run to an offscreen 600×400 canvas, shows it, and offers the PNG
 * and the one-line summary. Everything on it is measured; see `share-card.ts`.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { renderShareCard, shareText } from './share-card';
import type { ShareCardData } from './share-card';

export function ShareResultCard({ data }: { data: ShareCardData }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (canvas !== null) renderShareCard(canvas, data);
  }, [open, data]);

  const download = (): void => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    canvas.toBlob((blob) => {
      if (blob === null) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gridguard-${data.scenarioName.toLowerCase().replace(/\s+/g, '-')}-${String(data.score)}.png`;
      link.click();
      // Revoking immediately can race the download in some browsers; one turn
      // of the event loop is enough and leaks nothing.
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    }, 'image/png');
  };

  const copy = (): void => {
    void navigator.clipboard?.writeText(shareText(data)).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    });
  };

  if (!open) {
    return (
      <button
        className="console-btn"
        onClick={() => {
          setOpen(true);
        }}
      >
        Share Result
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <canvas
        ref={canvasRef}
        // Displayed at half size; the file is the full 600×400.
        style={{
          width: 300,
          height: 200,
          borderRadius: 6,
          border: '1px solid #D3D7D2',
          boxShadow: '0 4px 16px -2px rgba(28, 37, 48, 0.18)',
        }}
        aria-label="Shareable result card"
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="console-btn-primary" onClick={download}>
          Download PNG
        </button>
        <button className="console-btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy summary'}
        </button>
        <button
          className="console-btn"
          onClick={() => {
            setOpen(false);
          }}
        >
          Close
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: '#8B97A3', maxWidth: 320, lineHeight: 1.45 }}>
        {shareText(data)}
      </div>
    </div>
  );
}
