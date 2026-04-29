import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { locationService, Country, State, City, LocationData } from '../../lib/locationServiceforRegister';
import { ALL_COUNTRIES } from '../../lib/locationConstants';

interface LocationSelectorProps {
  value: {
    country: string;
    countryCode: string;
    state: string;
    stateCode: string;
    city: string;
  };
  onChange: (location: LocationData) => void;
  disabled?: boolean;
  required?: boolean;
  showAutoDetect?: boolean;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  showAutoDetect = true
}) => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);

  const [loading, setLoading] = useState({
    countries: false,
    states: false,
    cities: false,
    autoDetect: false
  });

  const [error, setError] = useState<string | null>(null);

  // Popover state
  const [countryPopoverOpen, setCountryPopoverOpen] = useState(false);
  const [statePopoverOpen, setStatePopoverOpen] = useState(false);
  const [cityPopoverOpen, setCityPopoverOpen] = useState(false);
  
  // Search state
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  // Load countries on mount
  useEffect(() => {
    loadCountries();
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (value.countryCode) {
      loadStates(value.countryCode);
    } else {
      setStates([]);
      setCities([]);
    }
  }, [value.countryCode]);

  // Load cities when state changes
  useEffect(() => {
    if (value.countryCode && value.stateCode) {
      loadCities(value.countryCode, value.stateCode);
    } else {
      setCities([]);
    }
  }, [value.countryCode, value.stateCode]);

  const loadCountries = async () => {
    setLoading(prev => ({ ...prev, countries: true }));
    setError(null);
    try {
      const countriesData = await locationService.getCountries();
      setCountries(countriesData);
    } catch (err) {
      setError('Failed to load countries. Please refresh the page.');
      console.error('Error loading countries:', err);
    } finally {
      setLoading(prev => ({ ...prev, countries: false }));
    }
  };

  const loadStates = async (countryCode: string) => {
    setLoading(prev => ({ ...prev, states: true }));
    try {
      const statesData = await locationService.getStates(countryCode);
      setStates(statesData);
      if (value.state && !statesData.find(s => s.name === value.state)) {
        onChange({
          ...value,
          state: '',
          stateCode: '',
          city: ''
        });
      }
    } catch (err) {
      console.error('Error loading states:', err);
      setStates([]);
    } finally {
      setLoading(prev => ({ ...prev, states: false }));
    }
  };

  const loadCities = async (countryCode: string, stateCode: string) => {
    setLoading(prev => ({ ...prev, cities: true }));
    try {
      const citiesData = await locationService.getCities(countryCode, stateCode);
      setCities(citiesData);
      if (value.city && !citiesData.find(c => c.name === value.city)) {
        onChange({
          ...value,
          city: ''
        });
      }
    } catch (err) {
      console.error('Error loading cities:', err);
      setCities([]);
    } finally {
      setLoading(prev => ({ ...prev, cities: false }));
    }
  };

  const handleAutoDetectLocation = async () => {
    setLoading(prev => ({ ...prev, autoDetect: true }));
    setError(null);
    try {
      const detectedLocation = await locationService.getUserLocation();
      console.log('Raw detected location:', detectedLocation);
      
      if (!detectedLocation) {
        setError('Unable to detect your location. Please select manually.');
        return;
      }

      // Ensure countries are loaded first
      let currentCountries = countries;
      if (currentCountries.length === 0) {
        console.log('Loading countries for auto-detect...');
        const countriesData = await locationService.getCountries();
        setCountries(countriesData);
        currentCountries = countriesData;
      }

      // Find matching country with robust fuzzy matching
      let matchedCountry = null;
      
      // Try exact matches first
      matchedCountry = currentCountries.find(c => 
        c.name.toLowerCase() === detectedLocation.country.toLowerCase() ||
        c.code.toLowerCase() === detectedLocation.countryCode?.toLowerCase()
      );
      
      // Try fuzzy matching if exact match fails
      if (!matchedCountry) {
        const countryVariants = [
          detectedLocation.country,
          detectedLocation.country.replace(/United States.*/, 'United States'),
          detectedLocation.country.replace(/.*States.*/, 'United States'),
          detectedLocation.country.replace(/.*Kingdom.*/, 'United Kingdom'),
          detectedLocation.country.replace(/\s+of\s+.*/, '').trim(), // Remove "of America" etc.
        ].filter(Boolean);
        
        for (const variant of countryVariants) {
          matchedCountry = currentCountries.find(c => 
            c.name.toLowerCase().includes(variant.toLowerCase()) ||
            variant.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchedCountry) {
            console.log(`Matched country "${detectedLocation.country}" to "${matchedCountry.name}" using variant "${variant}"`);
            break;
          }
        }
      }

      if (!matchedCountry) {
        console.warn('Could not match detected country:', detectedLocation.country);
        setError(`Could not find "${detectedLocation.country}" in our country list. Please select manually.`);
        return;
      }

      console.log('Matched country:', matchedCountry);

      // Set country and load states
      const newLocationData = {
        country: matchedCountry.name,
        countryCode: matchedCountry.code,
        state: '',
        stateCode: '',
        city: ''
      };

      // Load and match state if detected
      if (detectedLocation.state) {
        try {
          console.log('Loading states for country:', matchedCountry.code);
          const statesData = await locationService.getStates(matchedCountry.code);
          setStates(statesData);
          
          if (statesData.length > 0) {
            // Find matching state
            let matchedState = statesData.find(s => 
              s.name.toLowerCase() === detectedLocation.state.toLowerCase() ||
              s.adminCode1?.toLowerCase() === detectedLocation.stateCode?.toLowerCase()
            );

            // Try partial matching if exact fails
            if (!matchedState) {
              matchedState = statesData.find(s => 
                s.name.toLowerCase().includes(detectedLocation.state.toLowerCase()) ||
                detectedLocation.state.toLowerCase().includes(s.name.toLowerCase())
              );
            }

            if (matchedState) {
              console.log('Matched state:', matchedState);
              newLocationData.state = matchedState.name;
              newLocationData.stateCode = matchedState.adminCode1;

              // Load and match city if detected
              if (detectedLocation.city) {
                try {
                  console.log('Loading cities for state:', matchedState.adminCode1);
                  const citiesData = await locationService.getCities(matchedCountry.code, matchedState.adminCode1);
                  setCities(citiesData);
                  
                  if (citiesData.length > 0) {
                    // Find matching city
                    let matchedCity = citiesData.find(c => 
                      c.name.toLowerCase() === detectedLocation.city.toLowerCase()
                    );

                    // Try partial matching if exact fails
                    if (!matchedCity) {
                      matchedCity = citiesData.find(c => 
                        c.name.toLowerCase().includes(detectedLocation.city.toLowerCase()) ||
                        detectedLocation.city.toLowerCase().includes(c.name.toLowerCase())
                      );
                    }

                    if (matchedCity) {
                      console.log('Matched city:', matchedCity);
                      newLocationData.city = matchedCity.name;
                    } else {
                      console.warn(`Could not match detected city "${detectedLocation.city}" in ${matchedState.name}`);
                    }
                  }
                } catch (err) {
                  console.warn('Error loading cities for auto-detect:', err);
                }
              }
            } else {
              console.warn(`Could not match detected state "${detectedLocation.state}" in ${matchedCountry.name}`);
            }
          }
        } catch (err) {
          console.warn('Error loading states for auto-detect:', err);
        }
      }

      console.log('Final auto-detected location data:', newLocationData);
      onChange(newLocationData);

      // Show success message if we got at least country + state
      if (newLocationData.state) {
        setError(null);
      } else if (newLocationData.country) {
        setError(`Detected your country as ${newLocationData.country}. Please select your state/province manually.`);
      }

    } catch (err) {
      console.error('Error in auto-detect:', err);
      setError('Failed to detect location. Please select manually.');
    } finally {
      setLoading(prev => ({ ...prev, autoDetect: false }));
    }
  };

  const handleCountrySelect = useCallback((countryCode: string) => {
    const selectedCountry = countries.find(c => c.code === countryCode);
    if (selectedCountry) {
      onChange({
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        state: '',
        stateCode: '',
        city: ''
      });
      setCountryPopoverOpen(false);
      setCountrySearch('');
    }
  }, [countries, onChange]);

  const handleStateSelect = useCallback((stateName: string) => {
    const selectedState = states.find(s => s.name === stateName);
    if (selectedState) {
      onChange({
        ...value,
        state: selectedState.name,
        stateCode: selectedState.adminCode1,
        city: ''
      });
      setStatePopoverOpen(false);
      setStateSearch('');
    }
  }, [states, value, onChange]);

  const handleCitySelect = useCallback((cityName: string) => {
    onChange({
      ...value,
      city: cityName
    });
    setCityPopoverOpen(false);
    setCitySearch('');
  }, [value, onChange]);

  const filteredCountries = countrySearch
    ? countries.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : countries;

  const filteredStates = stateSearch
    ? states.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()))
    : states;

  const filteredCities = citySearch
    ? cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 100)
    : cities.slice(0, 100);

  return (
    <div className="space-y-4">

      {showAutoDetect && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleAutoDetectLocation}
            disabled={disabled || loading.autoDetect}
            className="text-sm"
          >
            {loading.autoDetect ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-2" />
            )}
            {loading.autoDetect ? 'Detecting...' : 'Auto-detect my location'}
          </Button>
        </div>
      )}

      {/* Country Selection (Combobox) */}
      <div>
        <Label htmlFor="country">
          Country {required && <span className="text-destructive">*</span>}
        </Label>
        <Popover open={countryPopoverOpen} onOpenChange={setCountryPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={countryPopoverOpen}
              className="w-full mt-1 justify-between text-card-foreground"
              disabled={disabled || loading.countries}
            >
              {value.country === ALL_COUNTRIES
                ? ALL_COUNTRIES
                : value.country || (loading.countries ? "Loading countries..." : "Select country")}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput
                placeholder="Search countries..."
                value={countrySearch}
                onValueChange={setCountrySearch}
              />
              <CommandList>
                {loading.countries ? (
                  <CommandEmpty>
                    <div className="flex items-center justify-center p-2">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </div>
                  </CommandEmpty>
                ) : (
                  <>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {filteredCountries.map((country) => (
                        <CommandItem
                          key={country.code}
                          value={country.name}
                          onSelect={() => handleCountrySelect(country.code)}
                        >
                          <div className="flex items-center">
                            {country.flag && <span className="mr-2">{country.flag}</span>}
                            {country.name}
                          </div>
                        </CommandItem>
                      ))}
                      <CommandItem
                        key="all"
                        value={ALL_COUNTRIES}
                        onSelect={() =>
                          onChange({
                            country: ALL_COUNTRIES,
                            countryCode: "",
                            state: "",
                            stateCode: "",
                            city: "",
                          })
                        }
                      >
                        🌍 All countries
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* State/Province Selection */}
      {value.countryCode && value.country !== ALL_COUNTRIES && (
        <div>
          <Label htmlFor="state">
            State/Province {required && <span className="text-destructive">*</span>}
          </Label>
          <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={statePopoverOpen}
                className="w-full mt-1 justify-between text-card-foreground"
                disabled={disabled || loading.states || states.length === 0}
              >
                {value.state || (loading.states ? "Loading states..." : states.length === 0 ? "No states available" : "Select state/province")}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search states..."
                  value={stateSearch}
                  onValueChange={setStateSearch}
                />
                <CommandList>
                  {loading.states ? (
                    <CommandEmpty>
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </div>
                    </CommandEmpty>
                  ) : (
                    <>
                      <CommandEmpty>No state found.</CommandEmpty>
                      <CommandGroup>
                        {filteredStates.map((state) => (
                          <CommandItem
                            key={state.geonameId}
                            value={state.name}
                            onSelect={() => handleStateSelect(state.name)}
                          >
                            {state.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* City Selection */}
      {value.countryCode && value.state && value.country !== ALL_COUNTRIES && (
        <div>
          <Label htmlFor="city">
            City {required && <span className="text-destructive">*</span>}
          </Label>
          <Popover open={cityPopoverOpen} onOpenChange={setCityPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={cityPopoverOpen}
                className="w-full mt-1 justify-between font-normal text-card-foreground"
                disabled={disabled || loading.cities || cities.length === 0}
              >
                {value.city || (
                  loading.cities
                    ? "Loading cities..."
                    : cities.length === 0
                      ? "No cities available"
                      : "Select city"
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search cities..."
                  value={citySearch}
                  onValueChange={setCitySearch}
                />
                <CommandList>
                  {loading.cities ? (
                    <CommandEmpty>
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </div>
                    </CommandEmpty>
                  ) : (
                    <>
                      <CommandEmpty>No city found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCities.map((city) => (
                          <CommandItem
                            key={city.geonameId}
                            value={city.name}
                            onSelect={() => handleCitySelect(city.name)}
                          >
                            <div className="flex flex-col">
                              <span>{city.name}</span>
                              {city.population && city.population > 0 && (
                                <span className="text-xs text-text-muted">
                                  Population: {city.population.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;