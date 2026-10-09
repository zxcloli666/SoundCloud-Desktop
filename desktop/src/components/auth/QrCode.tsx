import QRCodeStyling, { type Options } from 'qr-code-styling';
import React, { useEffect, useMemo, useRef } from 'react';
import { useSettingsStore } from '../../stores/settings';
import './qr-code.css';

interface QrCodeProps {
  payload: string;
  size?: number;
}

const QUIET_ZONE_PX = 24;

function lighten(hex: string, amount: number): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return hex;
  const [r, g, b] = m.map((h) => Number.parseInt(h, 16));
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m) return `rgba(255,255,255,${alpha})`;
  const [r, g, b] = m.map((h) => Number.parseInt(h, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export const QrCode = React.memo(({ payload, size = 280 }: QrCodeProps) => {
  const accent = useSettingsStore((s) => s.accentColor);
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  const accentLight = useMemo(() => lighten(accent, 0.35), [accent]);
  const accentSoft = useMemo(() => hexToRgba(accent, 0.55), [accent]);
  const accentGlow = useMemo(() => hexToRgba(accent, 0.45), [accent]);

  const options = useMemo<Options>(
    () => ({
      width: size,
      height: size,
      type: 'canvas',
      data: payload,
      margin: QUIET_ZONE_PX,
      qrOptions: { errorCorrectionLevel: 'M' },
      backgroundOptions: { color: '#ffffff' },
      dotsOptions: { type: 'square', color: '#000000' },
      cornersSquareOptions: { type: 'square', color: '#000000' },
      cornersDotOptions: { type: 'square', color: '#000000' },
    }),
    [payload, size],
  );

  useEffect(() => {
    if (!ref.current) return;
    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(options);
      qrRef.current.append(ref.current);
    } else {
      qrRef.current.update(options);
    }
  }, [options]);

  const cssVars = {
    '--qr-accent': accent,
    '--qr-accent-light': accentLight,
    '--qr-accent-soft': accentSoft,
    '--qr-accent-glow': accentGlow,
  } as React.CSSProperties;

  const frameSize = size + 56;

  return (
    <div className="qr-shell" style={{ ...cssVars, width: frameSize, height: frameSize }}>
      <div className="qr-aurora" aria-hidden />
      <div className="qr-rim">
        <div className="qr-frame">
          <div className="qr-mesh" aria-hidden />
          <div className="qr-specular" aria-hidden />
          <div className="qr-canvas">
            <div ref={ref} style={{ width: size, height: size }} />
          </div>
        </div>
      </div>
    </div>
  );
});
QrCode.displayName = 'QrCode';
