import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import mapboxgl, { type AnySourceData, type LngLatLike, type Map as MapboxMap, type Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useApp } from '@/context/AppContext';
import boundary from '@/lib/aradhanaBoundary';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { makeObjectUrlFromRef } from '@/lib/idbImageStore';

type LngLatTuple = [number, number];

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) return path;
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
  return `${baseNoSlash}${pathWithSlash}`;
};

type Corners4 = [[number, number], [number, number], [number, number], [number, number]];

type CornerKey = 'lng' | 'lat';

type MapboxImageSource = mapboxgl.ImageSource & {
  updateImage?: (options: { url?: string; coordinates?: Corners4 }) => void;
  setCoordinates?: (coordinates: Corners4) => void;
};

const DEFAULT_LAND_CORNERS: Corners4 = [
  [72.88638384002304, 21.18693643432666],
  [72.88657589833529, 21.18627221433158],
  [72.88862142140012, 21.18654325550465],
  [72.88849713957224, 21.18722347804809],
];

const orderImageCoords = (coords: Corners4): Corners4 => {
  const pts = coords.slice(0, 4);
  const scored = pts.map(([lng, lat]) => ({
    lng,
    lat,
    sum: lng + lat,
    diff: lat - lng,
  }));

  const tl = scored.reduce((a, b) => (a.diff > b.diff ? a : b));
  const br = scored.reduce((a, b) => (a.diff < b.diff ? a : b));
  const tr = scored.reduce((a, b) => (a.sum > b.sum ? a : b));
  const bl = scored.reduce((a, b) => (a.sum < b.sum ? a : b));

  return [
    [tl.lng, tl.lat],
    [tr.lng, tr.lat],
    [br.lng, br.lat],
    [bl.lng, bl.lat],
  ] as Corners4;
};

const applyCornerFlip = (coords: Corners4, flipH: boolean, flipV: boolean): Corners4 => {
  const c: Corners4 = [...coords] as Corners4;
  let out: Corners4 = c;

  if (flipH) {
    out = [out[1], out[0], out[3], out[2]];
  }
  if (flipV) {
    out = [out[3], out[2], out[1], out[0]];
  }

  return out;
};

export default function ProjectMap() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, currentProject, setCurrentProject, updateProject, isAdmin, user } = useApp();

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const didInitialFitRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;
    const project = projects.find((p) => p.id === projectId) || null;
    setCurrentProject(project);
    if (!project) {
      navigate('/');
      return;
    }

    const needsFullProject = !project.mapConfig;
    if (needsFullProject) {
      fetch(apiUrl(`/api/projects/${projectId}`))
        .then((r) => (r.ok ? r.json() : null))
        .then((full) => {
          if (full && full.id === projectId) {
            setCurrentProject(full);
          }
        })
        .catch(() => {});
    }
  }, [projectId, projects, setCurrentProject, navigate]);

  const initialImageUrl = useMemo(() => {
    if (!currentProject) return '/aradhana.png';
    return currentProject.mapConfig?.imageUrl || currentProject.layoutImage || '/aradhana.png';
  }, [currentProject]);

  const [imageUrl, setImageUrl] = useState<string>(initialImageUrl);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('');
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [opacity, setOpacity] = useState<number>(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rawCorners, setRawCorners] = useState<Corners4>(() => orderImageCoords(DEFAULT_LAND_CORNERS));

  useEffect(() => {
    if (!currentProject) return;
    setImageUrl(currentProject.mapConfig?.imageUrl || currentProject.layoutImage || '/aradhana.png');
    setOpacity(currentProject.mapConfig?.opacity ?? 1);
    setFlipH(currentProject.mapConfig?.flipH ?? false);
    setFlipV(currentProject.mapConfig?.flipV ?? false);
    setRawCorners(orderImageCoords(currentProject.mapConfig?.corners ?? DEFAULT_LAND_CORNERS));
  }, [currentProject]);

  useEffect(() => {
    didInitialFitRef.current = false;
  }, [currentProject?.id, imageUrl]);

  useEffect(() => {
    let cancelled = false;
    let nextObjectUrl: string | null = null;
    const prevUrl = resolvedImageUrl;

    (async () => {
      setIsImageLoading(true);
      try {
        const url = await makeObjectUrlFromRef(imageUrl);
        if (cancelled) return;
        nextObjectUrl = url;

        if (!url && imageUrl.startsWith('s3:')) {
          setResolvedImageUrl('/aradhana.png');
        } else {
          setResolvedImageUrl(url);
        }
        
        setIsImageLoading(false);
      } catch (error) {
        console.warn('Failed to resolve map image:', error);
        if (cancelled) return;
        // Use fallback image on error
        setResolvedImageUrl('/aradhana.png');
        setIsImageLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (prevUrl && prevUrl.startsWith('blob:') && prevUrl !== nextObjectUrl) {
        URL.revokeObjectURL(prevUrl);
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
  }, []);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    if (!currentProject) return;
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 0],
      zoom: 1.2,
      pitch: 0,
      bearing: 0,
      antialias: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      if (!map.getSource('boundary')) {
        map.addSource('boundary', ({ type: 'geojson', data: boundary } as unknown) as AnySourceData);
      }
      if (!map.getLayer('boundary-mask')) {
        map.addLayer({
          id: 'boundary-mask',
          type: 'fill',
          source: 'boundary',
          paint: {
            'fill-color': '#000',
            'fill-opacity': 0,
          },
        });
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [currentProject]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'project-image';
    const LAYER_ID = 'project-image-layer';

    const applyUpdate = () => {
      if (!imageUrl || isImageLoading || !resolvedImageUrl) {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        return;
      }

      const orderedRaw = orderImageCoords(rawCorners);
      const coords = applyCornerFlip(orderedRaw, flipH, flipV);

      try {
        const src = map.getSource(SOURCE_ID) as MapboxImageSource | undefined;
        const canUpdateImage = Boolean(src && typeof src.updateImage === 'function');
        const canSetCoordinates = Boolean(src && typeof src.setCoordinates === 'function');

        if (src && (canUpdateImage || canSetCoordinates)) {
          if (canUpdateImage) {
            src.updateImage?.({ url: resolvedImageUrl, coordinates: coords });
          } else {
            src.setCoordinates?.(coords);
            if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
            map.removeSource(SOURCE_ID);
            map.addSource(SOURCE_ID, {
              type: 'image',
              url: resolvedImageUrl,
              coordinates: coords,
            });
          }
        } else {
          if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
          if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
          map.addSource(SOURCE_ID, {
            type: 'image',
            url: resolvedImageUrl,
            coordinates: coords,
          });
        }

        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            source: SOURCE_ID,
            type: 'raster',
            paint: { 'raster-opacity': opacity },
          });
        } else {
          map.setPaintProperty(LAYER_ID, 'raster-opacity', opacity);
        }

        if (!isAdmin) return;

        const colors = ['#ff3b30', '#34c759', '#007aff', '#ffcc00'];
        if (markersRef.current.length === 0) {
          markersRef.current = coords.map((c, idx) => {
            const marker = new mapboxgl.Marker({ draggable: true, color: colors[idx] })
              .setLngLat(c as unknown as LngLatLike)
              .addTo(map);

            marker.on('dragend', () => {
              const next = markersRef.current.map((m) => {
                const ll = m.getLngLat();
                return [ll.lng, ll.lat] as LngLatTuple;
              }) as unknown as Corners4;

              setRawCorners(orderImageCoords(applyCornerFlip(next, flipH, flipV)));
            });

            return marker;
          });
        } else {
          markersRef.current.forEach((m, idx) => {
            if (coords[idx]) m.setLngLat(coords[idx] as unknown as LngLatLike);
          });
        }
      } catch (error) {
        console.error('Failed to update map image:', error);
        // Clean up on error
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
      }
    };

    if (map.isStyleLoaded()) {
      applyUpdate();
      return;
    }

    map.once('load', applyUpdate);
  }, [imageUrl, resolvedImageUrl, isImageLoading, opacity, rawCorners, flipH, flipV, isAdmin]);

  const onUploadFile = (file: File | undefined) => {
    if (!file) return;

    const okTypes = ['image/png', 'image/jpeg'];
    if (!okTypes.includes(file.type)) {
      toast.error('Please upload a PNG or JPEG image');
      return;
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error('Image is too large (max 10MB)');
      return;
    }

    (async () => {
      try {
        const extRaw = file.name.split('.').pop() || '';
        const ext = extRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

        const presign = await fetch(apiUrl('/api/storage/presign-upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
          },
          body: JSON.stringify({ contentType: file.type, prefix: 'project-maps', ext }),
        });
        if (!presign.ok) throw new Error('Could not prepare upload');
        const presignJson = (await presign.json()) as { key?: string; url?: string };
        if (!presignJson?.key || !presignJson?.url) throw new Error('Could not prepare upload');

        const put = await fetch(presignJson.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!put.ok) throw new Error('Upload failed');

        setImageUrl(`s3:${presignJson.key}`);
      } catch {
        // S3 upload failed, convert to base64 data URL instead
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          setImageUrl(base64);
        } catch {
          toast.error('Image upload failed');
        }
      }
    })();
  };

  const updateCorner = (idx: number, key: CornerKey, value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;

    setRawCorners((prev) => {
      const next = prev.map((p) => [...p]) as Corners4;
      if (key === 'lng') next[idx][0] = num;
      if (key === 'lat') next[idx][1] = num;
      return next;
    });
  };

  const flyToImage = () => {
    const map = mapRef.current;
    if (!map) return;

    const corners = applyCornerFlip(orderImageCoords(rawCorners), flipH, flipV);
    const lngs = corners.map((c) => c[0]);
    const lats = corners.map((c) => c[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 80, duration: 900 }
    );
  };

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!currentProject) return;
    if (!imageUrl) return;
    if (isImageLoading) return;
    if (didInitialFitRef.current) return;

    const run = () => {
      if (didInitialFitRef.current) return;
      const corners = applyCornerFlip(orderImageCoords(rawCorners), flipH, flipV);
      const lngs = corners.map((c) => c[0]);
      const lats = corners.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80, duration: 10000 }
      );
      didInitialFitRef.current = true;
    };

    if (map.isStyleLoaded()) {
      run();
      return;
    }

    map.once('load', run);
  }, [currentProject, imageUrl, isImageLoading, rawCorners, flipH, flipV]);

  const handleSave = () => {
    if (!currentProject) return;

    updateProject(currentProject.id, {
      mapConfig: {
        imageUrl,
        corners: orderImageCoords(rawCorners),
        opacity,
        flipH,
        flipV,
      },
    });

    toast.success('Map saved');
  };

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="text-xl font-semibold text-foreground">Mapbox token missing</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Set VITE_MAPBOX_TOKEN in a .env file at the project root, then restart the dev server.
          </div>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground">Loading project...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin && !currentProject.mapConfig && !currentProject.layoutImage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="text-xl font-semibold text-foreground">Map not available</div>
          <div className="mt-2 text-sm text-muted-foreground">Admin has not saved a map for this project yet.</div>
          <div className="mt-6">
            <Button variant="outline" onClick={() => navigate(`/project/${currentProject.id}`)}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100vw',
          height: '100vh',
        }}
      />

      {isImageLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            zIndex: 9,
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-muted-foreground">Loading map...</div>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 10,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 8,
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        <Button variant="outline" onClick={() => navigate(`/project/${currentProject.id}`)}>
          Back
        </Button>
        {isAdmin && (
          <Button onClick={handleSave}>
            Save
          </Button>
        )}
      </div>

      {isAdmin && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
            padding: 12,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Project Map</div>

          <div style={{ marginBottom: 10 }}>
            <Button onClick={handleSave} className="w-full">
              Save Map
            </Button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Upload image</div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onUploadFile(e.target.files?.[0])}
            style={{
              width: '100%',
              marginBottom: 10,
              color: '#fff',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 10,
              padding: 8,
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          />

          <button
            type="button"
            onClick={flyToImage}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Fly to image
          </button>

          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Opacity: {opacity.toFixed(2)}</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            style={{ width: '100%', marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setFlipH((v) => !v)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: flipH ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Flip H
            </button>

            <button
              type="button"
              onClick={() => setFlipV((v) => !v)}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: flipV ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Flip V
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>Corners (TL, TR, BR, BL)</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {rawCorners.map((c, idx) => (
              <div
                key={idx}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                  {idx === 0 ? 'TL' : idx === 1 ? 'TR' : idx === 2 ? 'BR' : 'BL'}
                </div>

                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Lng</div>
                <input
                  value={c[0]}
                  onChange={(e) => updateCorner(idx, 'lng', e.target.value)}
                  style={{
                    width: '100%',
                    marginBottom: 8,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />

                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Lat</div>
                <input
                  value={c[1]}
                  onChange={(e) => updateCorner(idx, 'lat', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
