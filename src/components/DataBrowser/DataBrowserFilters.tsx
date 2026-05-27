/**
 * Search bar, filter toggle, and the expanded filter card.
 *
 * Holds the search input as local state with a debounced commit to the shared
 * FilterContext so keystrokes don't ripple into the results table.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar, Filter, Search, ChevronDown, Check, X } from 'lucide-react';
import { useFilters, DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';
import { getFilterSummary } from '../../lib/filterUtils';
import { useStaticData } from '../../hooks/useStaticData';
import { fetchCropCategories } from '../../lib/fetchCropCategories';
import { MapFilter } from '../../types';

// ─── Brix range (inline) ─────────────────────────────────────────────────────
const STEP = 0.5;
const MIN_BRIX = 0;
const MAX_BRIX = 100;

function BrixRangeSlider({
  brixRange,
  onChange,
}: {
  brixRange: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  const [localValues, setLocalValues] = useState(brixRange);
  useEffect(() => { setLocalValues(brixRange); }, [brixRange]);

  // Drag updates only local state; commit on release pushes to context.
  const handleInputChange = (index: 0 | 1, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= MIN_BRIX && numValue <= MAX_BRIX) {
      const newRange: [number, number] = [...localValues];
      newRange[index] = numValue;
      if (newRange[0] <= newRange[1]) {
        setLocalValues(newRange);
        onChange(newRange);
      }
    }
  };

  return (
    <div className="space-y-5">
      <Slider
        value={localValues}
        onValueChange={(v) => setLocalValues([v[0], v[1]])}
        onValueCommit={(v) => onChange([v[0], v[1]])}
        max={MAX_BRIX}
        min={MIN_BRIX}
        step={STEP}
        className="w-full"
      />
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Min:</span>
          <Input
            type="number"
            value={localValues[0]}
            onChange={(e) => handleInputChange(0, e.target.value)}
            min={MIN_BRIX}
            max={MAX_BRIX}
            step={STEP}
            className="w-20 h-9 text-xs"
          />
        </div>
        <span className="text-muted-foreground">to</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Max:</span>
          <Input
            type="number"
            value={localValues[1]}
            onChange={(e) => handleInputChange(1, e.target.value)}
            min={MIN_BRIX}
            max={MAX_BRIX}
            step={STEP}
            className="w-20 h-9 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Filters component ──────────────────────────────────────────────────────
export default function DataBrowserFilters() {
  const { filters, setFilters, isAdmin } = useFilters();
  const { crops, brands, locations } = useStaticData();

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  useEffect(() => {
    fetchCropCategories().then(setAvailableCategories).catch(() => setAvailableCategories([]));
  }, []);

  // 300ms debounce on commit so keystrokes don't refetch the table.
  const [searchInput, setSearchInput] = useState(filters.search);
  useEffect(() => { setSearchInput(filters.search); }, [filters.search]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters(prev => ({ ...prev, search: searchInput }));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, setFilters]);

  const [showFilters, setShowFilters] = useState(false);
  const [cropCategoryQuery, setCropCategoryQuery] = useState('');
  const [brandQuery, setBrandQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [cropQuery, setCropQuery] = useState('');

  const filterSummary = getFilterSummary(filters, isAdmin);

  const handleFilterChange = (name: keyof MapFilter, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  const addCropType = (crop: string) =>
    setFilters(prev => prev.cropTypes.includes(crop) ? prev : { ...prev, cropTypes: [...prev.cropTypes, crop] });
  const removeCropType = (crop: string) =>
    setFilters(prev => ({ ...prev, cropTypes: prev.cropTypes.filter(c => c !== crop) }));

  const clearFilters = () => {
    setFilters(DEFAULT_MAP_FILTERS);
    setSearchInput('');
    setCropCategoryQuery('');
    setBrandQuery('');
    setLocationQuery('');
    setCropQuery('');
  };

  const filteredCategories = useMemo(
    () => availableCategories.filter(c => c.toLowerCase().includes(cropCategoryQuery.toLowerCase())),
    [availableCategories, cropCategoryQuery],
  );
  const filteredBrands = useMemo(
    () => brands.filter(b => (b.label || b.name).toLowerCase().includes(brandQuery.toLowerCase())),
    [brands, brandQuery],
  );
  const filteredLocations = useMemo(
    () => locations.filter(l => (l.label || l.name).toLowerCase().includes(locationQuery.toLowerCase())),
    [locations, locationQuery],
  );
  const filteredCrops = useMemo(
    () => crops.filter(c => c.name.toLowerCase().includes(cropQuery.toLowerCase())),
    [crops, cropQuery],
  );
  void filteredCategories;  // kept for future category dropdown

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-brown" />
          <Input
            placeholder="Search by crop, submitter, location, notes..."
            className="pl-9 pr-3 py-2 rounded-md border border-blue-pale focus-visible:ring-green-fresh/30"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(s => !s)}
          className="flex items-center space-x-2 border-blue-pale text-blue-deep hover:bg-blue-mist"
        >
          <Filter className="w-4 h-4" />
          <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
        </Button>
        {filterSummary !== 'No active filters' && (
          <Button variant="ghost" onClick={clearFilters} className="text-destructive">
            Clear Filters ({filterSummary.split(', ').filter(f => f !== 'None').length})
          </Button>
        )}
      </div>

      {showFilters && (
        <Card className="mb-6 rounded-2xl border border-blue-pale shadow-sm">
          <CardContent className="p-6 space-y-5">
            {/* Row 1 — dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Crop Types</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-sm" aria-haspopup="listbox">
                      Select Crops
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search crops..."
                        className="h-9"
                        value={cropQuery}
                        onValueChange={setCropQuery}
                        aria-label="Search crops"
                      />
                      <CommandList>
                        <CommandEmpty>No crops found.</CommandEmpty>
                        {filteredCrops.map((crop) => {
                          const selected = filters.cropTypes.includes(crop.name);
                          return (
                            <CommandItem
                              key={crop.id}
                              onSelect={() => {
                                selected ? removeCropType(crop.name) : addCropType(crop.name);
                                setCropQuery('');
                              }}
                              className="flex justify-between items-center"
                              aria-selected={selected}
                              role="option"
                            >
                              <span>{crop.name}</span>
                              {selected && <Check className="h-4 w-4" />}
                            </CommandItem>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {filters.cropTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3" aria-label="Selected crop types">
                    {filters.cropTypes.map((crop) => (
                      <Badge
                        key={crop}
                        variant="secondary"
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                      >
                        <span>{crop}</span>
                        <X
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove crop type ${crop}`}
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeCropType(crop)}
                          onKeyDown={(e) => e.key === 'Enter' && removeCropType(crop)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Brand/Farm Name</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-sm" aria-haspopup="listbox">
                      {filters.brand || 'Select Brand'}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search brand..."
                        className="h-9"
                        value={brandQuery}
                        onValueChange={setBrandQuery}
                        aria-label="Search brand"
                      />
                      <CommandList role="listbox" aria-label="Brands">
                        <CommandEmpty>No brands found.</CommandEmpty>
                        {filteredBrands.map((brand) => (
                          <CommandItem
                            key={brand.id}
                            onSelect={() => {
                              const brandValue = brand.label || brand.name;
                              handleFilterChange('brand', brandValue === filters.brand ? '' : brandValue);
                              setBrandQuery('');
                            }}
                            aria-selected={filters.brand === brand.name}
                            role="option"
                            className="flex justify-between items-center"
                          >
                            <span>{brand.label || brand.name}</span>
                            {filters.brand === (brand.label || brand.name) && <Check className="h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Point of Purchase</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between text-sm" aria-haspopup="listbox">
                      {filters.place || 'Select Location'}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search location..."
                        className="h-9"
                        value={locationQuery}
                        onValueChange={setLocationQuery}
                        aria-label="Search location"
                      />
                      <CommandList role="listbox" aria-label="Locations">
                        <CommandEmpty>No locations found.</CommandEmpty>
                        {filteredLocations.map((loc) => (
                          <CommandItem
                            key={loc.id}
                            onSelect={() => {
                              const locValue = loc.label || loc.name;
                              handleFilterChange('place', locValue === filters.place ? '' : locValue);
                              setLocationQuery('');
                            }}
                            aria-selected={filters.place === loc.name}
                            role="option"
                            className="flex justify-between items-center"
                          >
                            <span>{loc.label || loc.name}</span>
                            {filters.place === (loc.label || loc.name) && <Check className="h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Row 2 — slider + date pair */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">BRIX Range</Label>
                <BrixRangeSlider
                  brixRange={filters.brixRange}
                  onChange={(newRange) => {
                    if (newRange[0] <= newRange[1]) handleFilterChange('brixRange', newRange);
                  }}
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Date Range
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="start-date-data" className="text-xs">From</Label>
                    <Input
                      id="start-date-data"
                      type="date"
                      value={filters.dateRange[0]}
                      onChange={(e) => handleFilterChange('dateRange', [e.target.value, filters.dateRange[1]])}
                      className="text-sm"
                      aria-label="Start date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date-data" className="text-xs">To</Label>
                    <Input
                      id="end-date-data"
                      type="date"
                      value={filters.dateRange[1]}
                      onChange={(e) => handleFilterChange('dateRange', [filters.dateRange[0], e.target.value])}
                      className="text-sm"
                      aria-label="End date"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3 — toggles */}
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium">Has Image</Label>
                <Switch
                  checked={filters.hasImage}
                  onCheckedChange={(val) => handleFilterChange('hasImage', val)}
                  aria-checked={filters.hasImage}
                  role="switch"
                  aria-label="Filter by measurements with images"
                />
              </div>

              {isAdmin && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium">Verified Only</Label>
                  <Switch
                    checked={filters.verifiedOnly}
                    onCheckedChange={(val) => handleFilterChange('verifiedOnly', val)}
                    aria-checked={filters.verifiedOnly}
                    role="switch"
                    aria-label="Show only verified measurements"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
