const boundary = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Aradhana Business Park Boundary',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [72.87164999790367, 21.23467198982084],
            [72.87132065026869, 21.23498156692991],
            [72.87085023018331, 21.23453771058966],
            [72.8711747711726, 21.23419925905024],
            [72.87164999790367, 21.23467198982084],
          ],
        ],
      },
    },
  ],
} as const;

export default boundary;
