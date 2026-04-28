import { motion, useReducedMotion } from 'framer-motion';
import { scoreBrix } from '@/lib/getBrixColor';

export interface ClusterSample {
  brixValue: number;
  cropLabel: string;
  cropVariety: string | null;
  venueName: string | null;
  venueCity: string | null;
  poorBrix: number | null;
  excellentBrix: number | null;
}
export interface MapCluster { lat: number; lng: number; count: number; sample?: ClusterSample; }
export interface MapPreview {
  url: string;
  clusters: MapCluster[];
  center: { lat: number; lng: number };
  zoom: number;
}

// Web Mercator: returns position as % of the 560×380 static image
function toImagePct(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number,
): { x: number; y: number } {
  const S = 256 * Math.pow(2, zoom);
  const wx = (l: number) => (l + 180) / 360 * S;
  const wy = (l: number) => {
    const r = l * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * S;
  };
  return {
    x: Math.max(8, Math.min(92, (wx(lng) - wx(centerLng)) / 560 * 100 + 50)),
    y: Math.max(8, Math.min(92, (wy(lat) - wy(centerLat)) / 380 * 100 + 50)),
  };
}

export function MapPreviewPanel({ mapPreview }: { mapPreview: MapPreview | null }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col gap-2 mt-4 desktop:mt-0"
      {...(prefersReducedMotion ? {} : { initial: { opacity: 0, x: 40 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true }, transition: { duration: 0.6, delay: 0.2 } })}
    >
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Where people are testing their food
      </p>
      <div className="relative rounded-2xl overflow-hidden shadow-xl h-[200px] desktop:h-[260px]">
        {mapPreview ? (
          <>
            <img
              src={mapPreview.url}
              alt="Map showing community BRIX score locations"
              className="w-full h-full object-cover"
              loading="eager"
            />

            {/* Cluster circles + score popup for the largest cluster */}
            {(() => {
              const { clusters, center, zoom } = mapPreview;
              const largest = clusters[0];
              const largestPct = toImagePct(largest.lat, largest.lng, center.lat, center.lng, zoom);

              return (
                <>
                  {/* All cluster circles */}
                  {clusters.map((c, i) => {
                    const pct = toImagePct(c.lat, c.lng, center.lat, center.lng, zoom);
                    const d = c.count >= 200 ? 80 : c.count >= 50 ? 60 : c.count >= 10 ? 44 : 32;
                    return (
                      <div
                        key={i}
                        className="absolute pointer-events-none flex items-center justify-center rounded-full font-bold text-white text-sm"
                        style={{
                          top: `${pct.y}%`, left: `${pct.x}%`,
                          width: d, height: d,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: '#2d6a4f',
                          border: '2px solid rgba(255,255,255,0.6)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                          fontSize: d < 36 ? 11 : 13,
                        }}
                      >
                        {c.count}
                      </div>
                    );
                  })}

                  {/* Score popup on the largest cluster — arrow points down to it */}
                  {(() => {
                    const s = largest.sample;
                    const score = s ? scoreBrix(
                      s.brixValue,
                      s.poorBrix != null && s.excellentBrix != null
                        ? { poor: s.poorBrix, average: null, good: null, excellent: s.excellentBrix }
                        : null,
                    ) : null;
                    const displayPct  = score?.display ?? '88%';
                    const quality     = score?.quality ?? 'Excellent';
                    const scoreColor  = score?.hex     ?? 'var(--green-mid)';
                    const productName = s
                      ? (s.cropVariety ? `${s.cropVariety} ${s.cropLabel}` : s.cropLabel)
                      : 'Banana';
                    const location = s ? (s.venueName || s.venueCity || '') : 'Aldi · Zurich';
                    return (
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          bottom: `calc(${100 - largestPct.y}% + 20px)`,
                          left: `${largestPct.x}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <div className="bg-white rounded-xl shadow-xl px-2 py-1.5 desktop:px-3 desktop:py-2.5 w-36 desktop:w-44 relative">
                          <div className="flex items-baseline gap-1 mb-0.5">
                            <span className="font-display font-bold text-base desktop:text-xl leading-none" style={{ color: scoreColor }}>
                              {displayPct}
                            </span>
                            <span className="font-semibold uppercase tracking-wide" style={{ color: scoreColor, fontSize: '10px' }}>
                              {quality}
                            </span>
                          </div>
                          <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--text-dark)' }}>
                            {productName}
                          </p>
                          {location && (
                            <p className="text-xs leading-snug hidden desktop:block" style={{ color: 'var(--text-muted)' }}>
                              {location}
                            </p>
                          )}
                          <p className="leading-snug mt-1 pt-1 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--blue-pale)', fontSize: '10px' }}>
                            {largest.count - 1} other submissions on this location
                          </p>
                          {/* Arrow tip pointing down toward the cluster circle */}
                          <div
                            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45"
                            style={{ boxShadow: '2px 2px 3px rgba(0,0,0,0.06)' }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </>
        ) : (
          <div className="w-full h-full bg-white/5 animate-pulse" />
        )}
      </div>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Verified scores from real growers and shoppers
      </p>
    </motion.div>
  );
}
