import { ImageResponse } from 'next/og';
import { getSites } from '@/lib/data';
import { spinePalette } from '@/components/closet/TextureFactory';

export const alt = 'Closet 404: an ofrenda for the dead web';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PICADO = ['#ff4f9a', '#ff9e00', '#8e5cff', '#2ecc8f', '#19b8d8', '#ffd23f'];

export default function Image() {
  const sites = getSites();
  const spines = sites.slice(0, 22);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0c0b0e',
          color: '#e9e4d8',
          padding: '0 64px',
        }}
      >
        <div style={{ display: 'flex', gap: 14, marginTop: 0 }}>
          {Array.from({ length: 14 }, (_, i) => (
            <div
              key={i}
              style={{ width: 62, height: 70, background: PICADO[i % PICADO.length], borderRadius: '0 0 8px 8px', opacity: 0.85 }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 54 }}>
          <div style={{ fontSize: 22, letterSpacing: 8, color: '#ff9e00', display: 'flex' }}>AN OFRENDA FOR THE DEAD WEB</div>
          <div style={{ fontSize: 132, lineHeight: 1, marginTop: 14, display: 'flex' }}>
            Closet&nbsp;<span style={{ color: '#ff9e00' }}>404</span>
          </div>
          <div style={{ fontSize: 28, color: '#8a8578', marginTop: 18, display: 'flex' }}>
            {`${sites.length} dead websites from the Wayback Machine. Hold a séance with an open-weight Gemma ghost.`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', marginBottom: 0, alignItems: 'flex-end' }}>
          {spines.map((s) => (
            <div
              key={s.id}
              style={{
                width: 40,
                height: 120 + (s.spine % 4) * 12,
                background: spinePalette(s).bg,
                borderTop: `6px solid ${spinePalette(s).band}`,
                borderRadius: '3px 3px 0 0',
              }}
            />
          ))}
        </div>
        <div style={{ height: 14, background: '#3a281b', marginLeft: -64, marginRight: -64 }} />
      </div>
    ),
    size
  );
}
