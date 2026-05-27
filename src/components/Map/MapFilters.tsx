import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { ChevronDown, Check, Calendar, X } from 'lucide-react';
import { fetchCropTypes } from '@/lib/fetchCropTypes';
import { fetchBrands } from '@/lib/fetchBrands';
import { fetchLocations } from '@/lib/fetchLocations';
import { fetchCropCategories } from '@/lib/fetchCropCategories';
import { Range, getTrackBackground } from 'react-range';
import { useFilters, DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';

import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
  CommandEmpty,
} from "@/components/ui/command";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const STEP = 0.5;
const MIN = 0;
const MAX = 100;

interface DatabaseItem {
  id: string;
  name: string;
}

const BrixRangeSlider = ({
  brixRange,
  onChange,
}: {
  brixRange: [number, number];
  onChange: (range: [number, number]) => void;
}) => {
  return (
    <Range
      values={brixRange}
      step={STEP}
      min={MIN}
      max={MAX}
      onChange={(values) => onChange([values[0], values[1]])}
      renderTrack={({ props, children }) => (
        <div
          {...props}
          style={{
            ...props.style,
            height: '6px',
            width: '100%',
            background: getTrackBackground({
              values: brixRange,
              colors: ['#ccc', '#3b82f6', '#ccc'],
              min: MIN,
              max: MAX,
            }),
            borderRadius: '4px',
          }}
        >
          {children}
        </div>
      )}
      renderThumb={({ props, index }) => (
        <div
          {...props}
          style={{
            ...props.style,
            height: '24px',
            width: '24px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0 0 2px #00000044',
          }}
        >
          <span style={{ color: '#fff', fontSize: '12px' }}>
            {brixRange[index].toFixed(1)}
          </span>
        </div>
      )}
    />
  );
};

const MapFilters: React.FC = () => {
  const { filters, setFilters, isAdmin } = useFilters();
  // Data options for dropdowns - now using DatabaseItem objects
  const [availableCrops, setAvailableCrops] = useState<DatabaseItem[]>([]);
  const [availableBrands, setAvailableBrands] = useState<DatabaseItem[]>([]);
  const [availableStores, setAvailableStores] = useState<DatabaseItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Search queries for filtering dropdowns
  const [cropCategoryQuery, setCropCategoryQuery] = useState('');
  const [brandQuery, setBrandQuery] = useState('');
  const [storeQuery, setStoreQuery] = useState('');
  const [cropQuery, setCropQuery] = useState('');

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [crops, brands, stores, categories] = await Promise.all([
          fetchCropTypes(),
          fetchBrands(),
          fetchLocations(),
          fetchCropCategories()
        ]);
        
        console.log('Loaded filter data:', { crops, brands, stores, categories });
        
        setAvailableCrops(crops);
        setAvailableBrands(brands);
        setAvailableStores(stores);
        setAvailableCategories(categories); // Assuming categories is still strings
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    loadFilters();
  }, []);

  // Memoize filtered dropdown items for performance - now filtering by name property
  const filteredCategories = useMemo(() =>
    availableCategories.filter(cat =>
      cat.toLowerCase().includes(cropCategoryQuery.toLowerCase())
    ), [availableCategories, cropCategoryQuery]);

  const filteredBrands = useMemo(() =>
    availableBrands.filter(brand =>
      brand.name.toLowerCase().includes(brandQuery.toLowerCase())
    ), [availableBrands, brandQuery]);

  const filteredStores = useMemo(() =>
    availableStores.filter(store =>
      store.name.toLowerCase().includes(storeQuery.toLowerCase())
    ), [availableStores, storeQuery]);

  const filteredCrops = useMemo(() =>
    availableCrops.filter(crop =>
      crop.name.toLowerCase().includes(cropQuery.toLowerCase())
    ), [availableCrops, cropQuery]);

  // Update filters helper
  const updateFilters = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Crop type add/remove helpers - now using crop name
  const addCropType = (cropName: string) => {
    setFilters(prev => {
      if (!prev.cropTypes.includes(cropName)) {
        return { ...prev, cropTypes: [...prev.cropTypes, cropName] };
      }
      return prev;
    });
  };
  const removeCropType = (cropName: string) => {
    setFilters(prev => ({
      ...prev,
      cropTypes: prev.cropTypes.filter(c => c !== cropName)
    }));
  };

  const clearAllFilters = () => {
    // Reset filters to the predefined default from the context
    setFilters(DEFAULT_MAP_FILTERS);
    // Clear search queries too
    setCropCategoryQuery('');
    setBrandQuery('');
    setStoreQuery('');
    setCropQuery('');
  };

  return (
    <Card className="h-fit shadow-md rounded-2xl border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">Filters</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-card-foreground"
            aria-label="Clear all filters"
          >
            Clear All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* Crop Types */}
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
          <Label className="text-sm font-medium mb-2 block">BRIX Range</Label>

          <BrixRangeSlider
            brixRange={filters.brixRange}
            onChange={(newRange) => {
              // Enforce valid range and update filters
              if (newRange[0] <= newRange[1]) {
                updateFilters('brixRange', newRange);
              }
            }}
          />
        </div>
          

        {/* Date Range */}
        <div>
          <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Date Range
          </Label>
          <div className="space-y-3">
            <div>
              <Label htmlFor="start-date" className="text-xs">From</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.dateRange[0]}
                onChange={(e) =>
                  updateFilters('dateRange', [e.target.value, filters.dateRange[1]])
                }
                className="text-sm"
                aria-label="Start date"
              />
            </div>
            <div>
              <Label htmlFor="end-date" className="text-xs">To</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.dateRange[1]}
                onChange={(e) =>
                  updateFilters('dateRange', [filters.dateRange[0], e.target.value])
                }
                className="text-sm"
                aria-label="End date"
              />
            </div>
          </div>
        </div>

        {/* Crop Category */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Crop Category</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-sm"
                aria-haspopup="listbox"
              >
                {filters.category || 'Select Category'}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search category..."
                  className="h-9"
                  value={cropCategoryQuery}
                  onValueChange={setCropCategoryQuery}
                  aria-label="Search crop categories"
                />
                <CommandList role="listbox" aria-label="Crop categories">
                  <CommandEmpty>No category found.</CommandEmpty>
                  {filteredCategories.map((category) => (
                    <CommandItem
                      key={category}
                      onSelect={() => {
                        updateFilters('category', category);
                        setCropCategoryQuery('');
                      }}
                      aria-selected={filters.category === category}
                      role="option"
                      className="flex justify-between items-center"
                    >
                      <span>{category}</span>
                      {filters.category === category && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Brand Name */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Brand Name</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-sm"
                aria-haspopup="listbox"
              >
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
                        updateFilters('brand', brand.name === filters.brand ? '' : brand.name);
                        setBrandQuery('');
                      }}
                      aria-selected={filters.brand === brand.name}
                      role="option"
                      className="flex justify-between items-center"
                    >
                      <span>{brand.name}</span>
                      {filters.brand === brand.name && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Store Name */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Store Name</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-sm"
                aria-haspopup="listbox"
              >
                {filters.location || 'Select Store'}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput
                  placeholder="Search store..."
                  className="h-9"
                  value={storeQuery}
                  onValueChange={setStoreQuery}
                  aria-label="Search store"
                />
                <CommandList role="listbox" aria-label="Stores">
                  <CommandEmpty>No stores found.</CommandEmpty>
                  {filteredStores.map((store) => (
                    <CommandItem
                      key={store.id}
                      onSelect={() => {
                        updateFilters('location', store.name === filters.location ? '' : store.name);
                        setStoreQuery('');
                      }}
                      aria-selected={filters.location === store.name}
                      role="option"
                      className="flex justify-between items-center"
                    >
                      <span>{store.name}</span>
                      {filters.location === store.name && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Has Image */}
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Has Image</Label>
          <Switch
            checked={filters.hasImage}
            onCheckedChange={(val) => updateFilters('hasImage', val)}
            aria-checked={filters.hasImage}
            role="switch"
            aria-label="Filter by measurements with images"
          />
        </div>

        {/* Verified Only - only for admins */}
        {isAdmin && (
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Verified Only</Label>
            <Switch
              checked={filters.verifiedOnly}
              onCheckedChange={(val) => updateFilters('verifiedOnly', val)}
              aria-checked={filters.verifiedOnly}
              role="switch"
              aria-label="Show only verified measurements"
            />
          </div>
        )}

        {/* Summary */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">Showing filtered measurements on map</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapFilters;