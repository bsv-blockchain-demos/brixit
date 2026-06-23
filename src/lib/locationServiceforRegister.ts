import { fetchFromGeonamesProxy } from './geonamesProxy';
import { countries } from '../data/countries';

export interface Country {
  code: string;
  name: string;
  flag?: string;
}

export interface State {
  geonameId: number;
  name: string;
  adminCode1: string;
}

export interface City {
  geonameId: number;
  name: string;
  adminName1: string;
  population?: number;
}

export interface LocationData {
  country: string;
  countryCode: string;
  state: string;
  stateCode: string;
  city: string;
  cityId?: number;
}

function getFlagEmoji(countryCode: string): any {
  return [...countryCode.toUpperCase()]
    .map(char => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export class LocationService {
  private static instance: LocationService;

  private countriesCache: Country[] | null = null;
  private statesCache: Map<string, State[]> = new Map();
  private citiesCache: Map<string, City[]> = new Map();

  private constructor() {}

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async getCountries(): Promise<Country[]> {
    if (this.countriesCache) {
      return this.countriesCache;
    }

    const countriesList = countries.map(country => ({
      ...country,
      flag: getFlagEmoji(country.code),
    }));

    this.countriesCache = countriesList;
    return countriesList;
  }

  async getStates(countryCode: string): Promise<State[]> {
    if (this.statesCache.has(countryCode)) {
      return this.statesCache.get(countryCode)!;
    }

    try {
      const countryGeonameId = await this.getCountryGeonameId(countryCode);
      const data = await fetchFromGeonamesProxy({
        endpoint: 'childrenJSON',
        queryParams: { geonameId: String(countryGeonameId) }
      });

      const states: State[] = (data.geonames || [])
        .filter((item: any) => item.fclName === 'country, state, region,...')
        .map((state: any) => ({
          geonameId: state.geonameId,
          name: state.name,
          adminCode1: state.adminCode1 || state.adminCodes1?.ISO3166_2 || ''
        }))
        .sort((a: State, b: State) => a.name.localeCompare(b.name));

      this.statesCache.set(countryCode, states);
      return states;
    } catch (error) {
      console.error('Error fetching states:', error);
      throw new Error('Failed to load states.');
    }
  }

  async getCities(countryCode: string, stateCode: string): Promise<City[]> {
    const cacheKey = `${countryCode}-${stateCode}`;
    if (this.citiesCache.has(cacheKey)) {
      return this.citiesCache.get(cacheKey)!;
    }

    try {
      const data = await fetchFromGeonamesProxy({
        endpoint: 'searchJSON',
        queryParams: {
          country: countryCode,
          adminCode1: stateCode,
          featureClass: 'P',
          maxRows: '1000'
        }
      });

      const cities: City[] = (data.geonames || [])
        .map((city: any) => ({
          geonameId: city.geonameId,
          name: city.name,
          adminName1: city.adminName1,
          population: city.population || 0
        }))
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .slice(0, 500);

      this.citiesCache.set(cacheKey, cities);
      return cities;
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw new Error('Failed to load cities.');
    }
  }

  async searchCities(countryCode: string, query: string, maxResults: number = 20): Promise<City[]> {
    if (!query || query.length < 2) return [];

    try {
      const data = await fetchFromGeonamesProxy({
        endpoint: 'searchJSON',
        queryParams: {
          country: countryCode,
          name_startsWith: query,
          featureClass: 'P',
          maxRows: String(maxResults)
        }
      });

      return (data.geonames || [])
        .map((city: any) => ({
          geonameId: city.geonameId,
          name: city.name,
          adminName1: city.adminName1,
          population: city.population || 0
        }))
        .sort((a, b) => (b.population || 0) - (a.population || 0));
    } catch (error) {
      console.error('Error searching cities:', error);
      throw new Error('Failed to search cities.');
    }
  }

  async getCountryGeonameId(countryCode: string): Promise<number> {
    const data = await fetchFromGeonamesProxy({
      endpoint: 'countryInfoJSON',
      queryParams: { country: countryCode }
    });

    if (data.geonames && data.geonames.length > 0) {
      return data.geonames[0].geonameId;
    }

    throw new Error('Country not found');
  }

  async getUserLocation(): Promise<LocationData | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;

            const data = await fetchFromGeonamesProxy({
              endpoint: 'findNearbyPlaceNameJSON',
              queryParams: {
                lat: String(latitude),
                lng: String(longitude)
              }
            });

            if (data.geonames && data.geonames.length > 0) {
              const place = data.geonames[0];
              
              // Return format matching what LocationSelector expects
              resolve({
                country: place.countryName,
                countryCode: place.countryCode,
                state: place.adminName1 || '',
                stateCode: place.adminCode1 || '',
                city: place.name,
                cityId: place.geonameId
              });
            } else {
              resolve(null);
            }
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            resolve(null);
          }
        },
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  }

  clearCache(): void {
    this.countriesCache = null;
    this.statesCache.clear();
    this.citiesCache.clear();
  }
}

export const locationService = LocationService.getInstance();
