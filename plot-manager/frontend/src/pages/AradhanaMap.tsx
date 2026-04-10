import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl, { type AnySourceData, type LngLatLike, type Map as MapboxMap, type Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import boundary from '@/lib/aradhanaBoundary';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { makeObjectUrlFromRef, storeFileImage } from '@/lib/idbImageStore';

type LngLatTuple = [number, number];

type CornerKey = 'lng' | 'lat';

type MapboxImageSource = mapboxgl.ImageSource & {
  updateImage?: (options: { url?: string; coordinates?: LngLatTuple[] }) => void;
  setCoordinates?: (coordinates: LngLatTuple[]) => void;
};

type Corners4 = [[number, number], [number, number], [number, number], [number, number]];

const DEFAULT_LAND_CORNERS: LngLatTuple[] = [
  [72.88638384002304, 21.18693643432666],
  [72.88657589833529, 21.18627221433158],
  [72.88862142140012, 21.18654325550465],
  [72.88849713957224, 21.18722347804809],
];

const orderImageCoords = (coords: LngLatTuple[]) => {
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
    [tl.lng, tl.lat] as LngLatTuple,
    [tr.lng, tr.lat] as LngLatTuple,
    [br.lng, br.lat] as LngLatTuple,
    [bl.lng, bl.lat] as LngLatTuple,
  ];
};

const applyCornerFlip = (coords: LngLatTuple[], flipH: boolean, flipV: boolean) => {
  const c = coords.slice(0, 4);
  let out = c;

  if (flipH) {
    out = [out[1], out[0], out[3], out[2]];
  }
  if (flipV) {
    out = [out[3], out[2], out[1], out[0]];
  }

  return out;
};

export default function AradhanaMap() {
  const { projects, updateProject, isAdmin } = useApp();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const rafRef = useRef<number | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [imageUrl, setImageUrl] = useState<string>('/aradhana.png');
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string>('/aradhana.png');
  const [opacity, setOpacity] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [imageEnabled, setImageEnabled] = useState(true);
  const [rawCorners, setRawCorners] = useState<LngLatTuple[]>(() => orderImageCoords(DEFAULT_LAND_CORNERS));

  useEffect(() => {
    let cancelled = false;
    let nextObjectUrl: string | null = null;
    const prevUrl = resolvedImageUrl;

    (async () => {
      try {
        const url = await makeObjectUrlFromRef(imageUrl);
        if (cancelled) return;
        nextObjectUrl = url;
        setResolvedImageUrl(url);
      } catch {
        if (cancelled) return;
        setResolvedImageUrl('');
      }
    })();

    return () => {
      cancelled = true;
      if (prevUrl && prevUrl.startsWith('blob:') && prevUrl !== nextObjectUrl) {
        URL.revokeObjectURL(prevUrl);
      }
    };
  }, [imageUrl]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const computeSavedCorners = (): Corners4 => {
    if (!rawCorners || rawCorners.length !== 4) {
      throw new Error('Please set all 4 corners');
    }

    const map = mapRef.current;

    const flippedCorners = applyCornerFlip(rawCorners, flipH, flipV);

    if (!map || (scale === 1 && rotation === 0)) {
      return flippedCorners as unknown as Corners4;
    }

    const pts = flippedCorners.map(([lng, lat]) => map.project({ lng, lat }));
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const out = pts.map((p) => {
      const dx = (p.x - cx) * scale;
      const dy = (p.y - cy) * scale;
      const x = cx + dx * cos - dy * sin;
      const y = cy + dx * sin + dy * cos;
      const ll = map.unproject([x, y]);
      return [ll.lng, ll.lat] as LngLatTuple;
    });

    return out as unknown as Corners4;
  };

  const handleSaveToProject = () => {
    if (!isAdmin) {
      toast.error('Only admin can save map configuration');
      return;
    }

    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    if (!imageEnabled || !imageUrl) {
      updateProject(selectedProjectId, { mapConfig: undefined });
      toast.success('Map removed from project');
      return;
    }

    try {
      const corners = computeSavedCorners();
      updateProject(selectedProjectId, {
        mapConfig: {
          imageUrl,
          corners,
          opacity,
          flipH: false,
          flipV: false,
        },
      });
      toast.success('Map saved to project');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save map');
    }
  };

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
  }, []);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) return;
    if (mapRef.current) return;
    if (!mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 0],
      zoom: 1.4,
      pitch: 45,
      bearing: 0,
      projection: 'globe',
      antialias: true,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.setFog({
        range: [-1, 2],
        color: 'white',
        'high-color': '#add8e6',
        'space-color': '#000000',
        'star-intensity': 0.3,
      });

      const rotationStart = performance.now();
      const rotateDuration = 4000;

      const rotateGlobe = () => {
        const now = performance.now();
        const elapsed = now - rotationStart;
        if (elapsed < rotateDuration) {
          map.jumpTo({ bearing: map.getBearing() + 0.4 });
          rafRef.current = requestAnimationFrame(rotateGlobe);
        } else {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          map.stop();
          startZoomSequence();
        }
      };

      const startZoomSequence = async () => {
        type FlyToOptions = Parameters<MapboxMap['flyTo']>[0];
        const flyToAsync = (options: FlyToOptions) =>
          new Promise<void>((resolve) => {
            map.once('moveend', () => resolve());
            map.flyTo(options);
          });

        await flyToAsync({
          center: [78.9629, 20.5937],
          zoom: 4,
          pitch: 0,
          bearing: 0,
          duration: 2500,
          essential: true,
        });

        await flyToAsync({
          center: [71.1924, 22.2587],
          zoom: 7,
          duration: 2000,
          essential: true,
        });

        await flyToAsync({
          center: [72.8311, 21.1702],
          zoom: 15,
          pitch: 0,
          bearing: 0,
          duration: 2000,
          essential: true,
        });

        map.stop();
        map.setBearing(0);
        map.setPitch(0);

        const imgCoords = orderImageCoords(DEFAULT_LAND_CORNERS);

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

        if (!map.getSource('land-boundary')) {
          map.addSource('land-boundary', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Polygon',
                coordinates: [[...DEFAULT_LAND_CORNERS, DEFAULT_LAND_CORNERS[0]]],
              },
            },
          });
        }

        if (!map.getLayer('land-fill')) {
          map.addLayer({
            id: 'land-fill',
            type: 'fill',
            source: 'land-boundary',
            paint: {
              'fill-color': '#0DA2E7',
              'fill-opacity': 0.4,
            },
          });
        }

        setRawCorners(imgCoords);
      };

      rotateGlobe();
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!rawCorners || rawCorners.length !== 4) return;

    const applyUpdate = () => {
      const SOURCE_ID = 'aradhana-image';
      const LAYER_ID = 'aradhana-layer';

      if (!imageEnabled) {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        return;
      }

      if (!imageUrl) {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        return;
      }

      const transformCorners = (coords: LngLatTuple[]) => {
        if (scale === 1 && rotation === 0) return coords;

        const pts = coords.map(([lng, lat]) => map.project({ lng, lat }));
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;

        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        return pts.map((p) => {
          const dx = (p.x - cx) * scale;
          const dy = (p.y - cy) * scale;
          const x = cx + dx * cos - dy * sin;
          const y = cy + dx * sin + dy * cos;
          const ll = map.unproject([x, y]);
          return [ll.lng, ll.lat] as LngLatTuple;
        });
      };

      const flippedCorners = applyCornerFlip(rawCorners, flipH, flipV);
      const coords = transformCorners(flippedCorners);

      const src = map.getSource(SOURCE_ID) as MapboxImageSource | undefined;
      const canUpdateImage = Boolean(src && typeof src.updateImage === 'function');
      const canSetCoordinates = Boolean(src && typeof src.setCoordinates === 'function');

      if (src && (canUpdateImage || canSetCoordinates)) {
        if (canUpdateImage) {
          src.updateImage?.({ url: resolvedImageUrl, coordinates: coords as unknown as Corners4 });
        } else {
          src.setCoordinates?.(coords as unknown as Corners4);
          if (map.getLayer(LAYER_ID)) {
            map.removeLayer(LAYER_ID);
          }
          map.removeSource(SOURCE_ID);
          map.addSource(SOURCE_ID, {
            type: 'image',
            url: resolvedImageUrl,
            coordinates: coords as unknown as Corners4,
          });
        }
      } else {
        if (map.getLayer(LAYER_ID)) {
          map.removeLayer(LAYER_ID);
        }
        if (map.getSource(SOURCE_ID)) {
          map.removeSource(SOURCE_ID);
        }
        map.addSource(SOURCE_ID, {
          type: 'image',
          url: resolvedImageUrl,
          coordinates: coords as unknown as Corners4,
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
            });
            setScale(1);
            setRotation(0);
            setRawCorners(applyCornerFlip(next, flipH, flipV));
          });

          return marker;
        });
      } else {
        markersRef.current.forEach((m, idx) => {
          if (coords[idx]) m.setLngLat(coords[idx] as unknown as LngLatLike);
        });
      }
    };

    if (map.isStyleLoaded()) {
      applyUpdate();
      return;
    }

    map.once('load', applyUpdate);
  }, [imageUrl, opacity, rawCorners, rotation, scale, flipH, flipV, imageEnabled]);

  const preloadImageUrl = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The source image could not be decoded'));
      img.src = url;
    });

  const onUploadFile = (file: File | undefined) => {
    console.log('File selected:', file?.name, 'Type:', file?.type, 'Size:', file?.size);
    if (!file) return;

    // Accept both MIME types and file extensions
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const okTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const okExts = ['png', 'jpg', 'jpeg'];
    
    if (!okTypes.includes(file.type) && !okExts.includes(ext)) {
      console.error('Invalid file type:', file.type, 'Extension:', ext);
      toast.error(`Invalid file: ${file.name} (${file.type || 'unknown type'}). Please upload PNG or JPEG only.`);
      return;
    }

    const tmpUrl = URL.createObjectURL(file);
    preloadImageUrl(tmpUrl)
      .then(async () => {
        try {
          const key = `map:aradhana:${Date.now()}`;
          console.log('Storing image with key:', key);
          const ref = await storeFileImage(file, key);
          console.log('Image stored successfully, ref:', ref);
          setImageUrl(ref);
          setImageEnabled(true);
          toast.success('Image uploaded successfully!');
        } catch (storageError) {
          console.error('Failed to store image:', storageError);
          toast.error('Failed to store image. Check console for details.');
        }
      })
      .catch((preloadError) => {
        console.error('Image preload failed:', preloadError);
        toast.error('Could not load image. Please use PNG/JPEG. Note: SVG is not supported by Mapbox.');
      })
      .finally(() => {
        URL.revokeObjectURL(tmpUrl);
      });
  };

  const deleteImage = () => {
    setImageEnabled(false);
    const map = mapRef.current;
    if (!map) return;

    const SOURCE_ID = 'aradhana-image';
    const LAYER_ID = 'aradhana-layer';

    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const updateCorner = (idx: number, key: CornerKey, value: string) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;

    setScale(1);
    setRotation(0);
    setRawCorners((prev) => {
      const next = prev.map((p) => [...p]) as LngLatTuple[];
      if (!next[idx]) return prev;
      if (key === 'lng') next[idx][0] = num;
      if (key === 'lat') next[idx][1] = num;
      return next;
    });
  };

  const flyToImage = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!rawCorners || rawCorners.length !== 4) return;

    const corners = applyCornerFlip(rawCorners, flipH, flipV);
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
      { padding: 80, duration: 1200 }
    );
  };

  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="text-xl font-semibold text-foreground">Admin only</div>
          <div className="mt-2 text-sm text-muted-foreground">
            This tool is available only for admin.
          </div>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
        <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Image Editor</span>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Back
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Upload image</div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onUploadFile(e.target.files?.[0])}
          style={{ width: '100%', marginBottom: 10 }}
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

        <button
          type="button"
          onClick={deleteImage}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'rgba(255,0,0,0.18)',
            color: '#fff',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          Delete image
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

        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Scale: {scale.toFixed(2)}</div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.01}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 10 }}
        />

        <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Rotation: {rotation.toFixed(0)}°</div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          onChange={(e) => setRotation(Number(e.target.value))}
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
                  padding: 6,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#fff',
                  color: '#111',
                }}
              />

              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Lat</div>
              <input
                value={c[1]}
                onChange={(e) => updateCorner(idx, 'lat', e.target.value)}
                style={{
                  width: '100%',
                  padding: 6,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#fff',
                  color: '#111',
                }}
              />
            </div>
          ))}
        </div>

        {isAdmin && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>Save to project</div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                width: '100%',
                marginBottom: 10,
                padding: 8,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: '#fff',
                color: '#111',
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveToProject}
              style={{
                width: '100%',
                padding: '10px 10px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(13,162,231,0.22)',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
