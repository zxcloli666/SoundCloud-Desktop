import QRCodeStyling, { type Options } from 'qr-code-styling';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import sonveilAppIconUrl from '../../assets/sonveil-app-icon.svg';
import { useSettingsStore } from '../../stores/settings';
import './qr-code.css';

interface QrCodeProps {
  payload: string;
  size?: number;
}

const LOGO_PX = 256; // 2× для retina-чёткости

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

let logoImg: HTMLImageElement | null = null;
function loadLogo(): Promise<HTMLImageElement> {
  if (logoImg?.complete && logoImg.naturalWidth) return Promise.resolve(logoImg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      logoImg = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error('logo load failed'));
    img.src = sonveilAppIconUrl;
  });
}

/**
 * Композитим круглый «app-icon»-style бейдж: SC-favicon заполняет весь круг,
 * сверху soft top-light highlight (Apple glass), снизу — eгкая внутренняя тень
 * для глубины, по периметру — тонкая белая hairline.
 *
 * favicon уже бренд-цвета (orange + cloud), так что accent сам по себе для
 * бейджа не используется — он управляет точками QR и обвязкой кадра.
 */
async function buildLogoBadge(): Promise<string> {
  const img = await loadLogo();
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_PX;
  canvas.height = LOGO_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d ctx');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const cx = LOGO_PX / 2;
  const cy = LOGO_PX / 2;
  const r = LOGO_PX / 2;

  // 1. Лого на весь круг.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, LOGO_PX, LOGO_PX);
  ctx.restore();

  // 2. Top-light highlight (gloss).
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const hi = ctx.createRadialGradient(cx, r * 0.15, r * 0.05, cx, r * 0.15, r * 1.1);
  hi.addColorStop(0, 'rgba(255,255,255,0.45)');
  hi.addColorStop(0.4, 'rgba(255,255,255,0.08)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.fillRect(0, 0, LOGO_PX, LOGO_PX);
  ctx.restore();

  // 3. Bottom inner shadow (depth).
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const sh = ctx.createRadialGradient(cx, cy + r * 0.1, r * 0.4, cx, cy + r * 0.1, r * 1.1);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, LOGO_PX, LOGO_PX);
  ctx.restore();

  // 4. Тонкая белая hairline.
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export const QrCode = React.memo(({ payload, size = 280 }: QrCodeProps) => {
  const accent = useSettingsStore((s) => s.accentColor);
  const ref = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [logoBadge, setLogoBadge] = useState<string | null>(null);

  const accentLight = useMemo(() => lighten(accent, 0.35), [accent]);
  const accentSoft = useMemo(() => hexToRgba(accent, 0.55), [accent]);
  const accentGlow = useMemo(() => hexToRgba(accent, 0.45), [accent]);

  // Бейдж перерисовываем один раз — он не зависит от accent.
  useEffect(() => {
    let cancelled = false;
    buildLogoBadge()
      .then((uri) => {
        if (!cancelled) setLogoBadge(uri);
      })
      .catch(() => {
        if (!cancelled) setLogoBadge(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo<Options>(
    () => ({
      width: size,
      height: size,
      type: 'canvas',
      data: payload,
      margin: 0,
      qrOptions: { errorCorrectionLevel: 'H' },
      backgroundOptions: { color: 'transparent' },
      image: logoBadge ?? undefined,
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: 2,
        imageSize: 0.3,
        hideBackgroundDots: true,
      },
      dotsOptions: {
        type: 'rounded',
        gradient: {
          type: 'linear',
          rotation: Math.PI / 4,
          colorStops: [
            { offset: 0, color: '#ffffff' },
            { offset: 0.5, color: accentLight },
            { offset: 1, color: accent },
          ],
        },
      },
      cornersSquareOptions: {
        type: 'extra-rounded',
        gradient: {
          type: 'linear',
          rotation: 0,
          colorStops: [
            { offset: 0, color: accent },
            { offset: 1, color: accentLight },
          ],
        },
      },
      cornersDotOptions: {
        type: 'dot',
        color: '#ffffff',
      },
    }),
    [accent, accentLight, payload, size, logoBadge],
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
