import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Mock data for testing
const mockClinics = [
  {
    name: "City Medical Center",
    address: "123 Healthcare Ave",
    distance: "2.5 km",
    rating: 4.5,
    specialization: "General Practice",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=City+Medical+Center"
  },
  {
    name: "Family Health Clinic",
    address: "456 Wellness Street",
    distance: "3.1 km",
    rating: 4.2,
    specialization: "Family Medicine",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Family+Health+Clinic"
  },
  {
    name: "Specialist Care Center",
    address: "789 Medical Boulevard",
    distance: "4.0 km",
    rating: 4.7,
    specialization: "Specialized Care",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Specialist+Care+Center"
  }
];

async function getDistance(origin: { lat: number, lng: number }, destination: { lat: number, lng: number }) {
  const distanceUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;
  
  const response = await fetch(distanceUrl);
  const data = await response.json();
  
  if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
    return data.rows[0].elements[0].distance.text;
  }
  return 'Distance unavailable';
}

async function searchNearbyClinics(lat: number, lng: number, specialty?: string) {
  const radius = 10000; // 10km radius for wider search
  
  // Define search terms based on specialty if provided
  let searchTerms = [];
  
  if (specialty) {
    // If specialty is provided, search specifically for that
    searchTerms = [
      { type: 'doctor', keyword: specialty },
      { type: 'hospital', keyword: specialty },
      { type: 'health', keyword: specialty },
      { type: 'clinic', keyword: specialty }
    ];
  } else {
    // Generic medical facility search if no specialty
    searchTerms = [
      { type: 'health', keyword: 'clinic' },
      { type: 'doctor', keyword: 'medical' },
      { type: 'hospital', keyword: '' },
      { type: 'pharmacy', keyword: '' },
      { type: '', keyword: 'urgent care' }
    ];
  }
  
  // Try each search term
  for (const term of searchTerms) {
    try {
      // Build the URL - if both type and keyword are provided, use both
      const typeParam = term.type ? `&type=${term.type}` : '';
      const keywordParam = term.keyword ? `&keyword=${term.keyword}` : '';
      
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}${typeParam}${keywordParam}&key=${GOOGLE_MAPS_API_KEY}`;

      console.log(`Searching for: ${term.type || 'any type'} ${term.keyword ? 'with keyword: ' + term.keyword : ''}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        console.log(`Found ${data.results.length} medical facilities`);
        
        // Process up to 5 results
        const clinics = [];
        for (let i = 0; i < Math.min(5, data.results.length); i++) {
          try {
            const place = data.results[i];
            const origin = { lat, lng };
            const destination = { 
              lat: place.geometry.location.lat, 
              lng: place.geometry.location.lng 
            };
            
            let distance = 'Distance unavailable';
            try {
              distance = await getDistance(origin, destination);
            } catch (distanceError) {
              console.error('Error getting distance:', distanceError);
            }
            
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.vicinity || ''}`)}`;
            
            clinics.push({
              name: place.name,
              address: place.vicinity || 'Address unavailable',
              distance: distance,
              rating: place.rating || 'No rating',
              specialization: specialty || 'Medical Facility',
              mapsUrl: mapsUrl
            });
          } catch (placeError) {
            console.error('Error processing place:', placeError);
          }
        }
        
        if (clinics.length > 0) {
          return clinics;
        }
      }
    } catch (error) {
      console.error('Error searching for clinics:', error);
    }
  }
  
  console.log('No results found after trying all search terms');
  return [];
}

async function getCoordinates(address: string) {
  try {
    const geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log('Geocoding address:', address);
    const response = await fetch(geocodingUrl);
    const data = await response.json();
    
    console.log('Geocoding API status:', data.status);
    
    if (data.status === 'OK' && data.results && data.results[0]) {
      const location = data.results[0].geometry.location;
      console.log('Found coordinates:', location);
      return location;
    }
    
    console.log('Could not geocode address, status:', data.status);
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    console.log('API Key configured:', !!GOOGLE_MAPS_API_KEY);
    
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { address, specialty } = requestBody;
    console.log('Received request with address:', address, 'and specialty:', specialty);

    if (!GOOGLE_MAPS_API_KEY) {
      console.log('Google Maps API key not configured, returning error');
      return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
    }

    // If an address was provided, try to geocode it first
    if (address) {
      const coordinates = await getCoordinates(address);
      if (coordinates) {
        console.log(`Using coordinates from provided address: ${coordinates.lat}, ${coordinates.lng}`);
        const clinics = await searchNearbyClinics(coordinates.lat, coordinates.lng, specialty);
        
        if (clinics.length > 0) {
          console.log(`Found ${clinics.length} clinics near the provided address`);
          return NextResponse.json(clinics);
        }
      }
      console.log('Could not find clinics near the provided address, trying default locations');
    }

    // Define multiple locations to try (major US cities)
    const locations = [
      { name: 'New York', lat: 40.7128, lng: -74.0060 },
      { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
      { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      { name: 'Houston', lat: 29.7604, lng: -95.3698 },
      { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
      { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
      { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
      { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
      { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
      { name: 'San Francisco', lat: 37.7749, lng: -122.4194 }
    ];

    // Try each location until we find clinics
    for (const location of locations) {
      console.log(`Trying location: ${location.name} (${location.lat}, ${location.lng})`);
      const clinics = await searchNearbyClinics(location.lat, location.lng, specialty);
      
      if (clinics.length > 0) {
        console.log(`Found ${clinics.length} clinics in ${location.name}`);
        return NextResponse.json(clinics);
      }
    }

    // If we've tried all locations and found nothing, return mock data with the right specialty
    console.log('No clinics found in any location, returning mock clinics');
    return NextResponse.json(mockClinics.map(clinic => ({
      ...clinic,
      specialization: specialty || clinic.specialization
    })));
    
  } catch (error) {
    console.error('Error in getNearbyClinicsBySpecialty:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch nearby clinics' }, 
      { status: 500 }
    );
  }
} 