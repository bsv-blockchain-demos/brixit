// src/components/DataBrowser/DataTable.tsx

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BrixDataPoint, MapFilter } from '../../types';

import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Calendar,
  Filter,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Check, ChevronDown, X,
  Loader2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFormattedSubmissionsCountQuery, useFormattedSubmissionsPageQuery } from '../../hooks/useSubmissions';
import { useFilters, DEFAULT_MAP_FILTERS } from '../../contexts/FilterContext';
import { getFilterSummary } from '../../lib/filterUtils';
import { fetchFormattedSubmissionsPage, type PublicFormattedSubmissionsQuery } from '../../lib/fetchSubmissions';
import { parseURLSearchParams, mergeFiltersWithDefaults } from '../../lib/urlFilterUtils';

import SubmissionTableRow from '../common/SubmissionTableRow';
import MobileSubmissionCard from '../common/MobileSubmissionCard';
import { useAuth } from '../../contexts/AuthContext';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import DataPointDetailModal from '../common/DataPointDetailModal';
import { useStaticData } from '../../hooks/useStaticData';
import { fetchCropCategories } from '../../lib/fetchCropCategories';

// Constants for Brix Range Slider
const STEP = 0.5;
const MIN_BRIX = 0;
const MAX_BRIX = 100;

const BrixRangeSlider = ({
  brixRange,
  onChange,
}: {
  brixRange: [number, number];
  onChange: (range: [number, number]) => void;
}) => {
  const [localValues, setLocalValues] = useState(brixRange);

  useEffect(() => {
    setLocalValues(brixRange);
  }, [brixRange]);

  const handleSliderChange = (values: number[]) => {
    const newRange: [number, number] = [values[0], values[1]];
    setLocalValues(newRange);
    onChange(newRange);
  };

  const handleInputChange = (index: 0 | 1, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= MIN_BRIX && numValue <= MAX_BRIX) {
      const newRange: [number, number] = [...localValues];
      newRange[index] = numValue;
      
      // Ensure min <= max
      if (newRange[0] <= newRange[1]) {
        setLocalValues(newRange);
        onChange(newRange);
      }
    }
  };

  return (
    <div className="space-y-3">
      <Slider
        value={localValues}
        onValueChange={handleSliderChange}
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
            className="w-16 h-7 text-xs"
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
            className="w-16 h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
};

const DataTable: React.FC = () => {
  const { filters, setFilters, isAdmin, setFilteredCount } = useFilters();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [urlFiltersApplied, setUrlFiltersApplied] = useState(false);

  // Corrected destructuring: useStaticData hook returns 'locations' not 'stores'.
  const { crops, brands, locations, isLoading: isLoadingStaticData } = useStaticData();

  // Re-added local state for categories since the hook doesn't provide it.
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // State for data submissions
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const chunkSize = 50;

  const [sortBy, setSortBy] = useState<keyof BrixDataPoint>('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const REFRESH_COOLDOWN_S = 15;
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRefresh = useCallback(() => {
    if (cooldownSeconds > 0) return;
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
    setCooldownSeconds(REFRESH_COOLDOWN_S);
    cooldownRef.current = setInterval(() => {
      setCooldownSeconds((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [queryClient, cooldownSeconds]);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const countQuery = useMemo(() => {
    const serverSortBy: NonNullable<PublicFormattedSubmissionsQuery['sortBy']> =
      sortBy === 'submittedAt'
        ? 'assessment_date'
        : sortBy === 'brixLevel'
          ? 'brix_value'
          : sortBy === 'cropType'
            ? 'crop_name'
            : sortBy === 'locationName'
              ? 'place_label'
              : 'assessment_date';

    const hasCustomBrixRange =
      filters.brixRange?.[0] !== DEFAULT_MAP_FILTERS.brixRange[0] ||
      filters.brixRange?.[1] !== DEFAULT_MAP_FILTERS.brixRange[1];

    const q: Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'> = {
      cropTypes: filters.cropTypes.length > 0 ? filters.cropTypes : undefined,
      category: filters.category || undefined,
      brand: filters.brand || undefined,
      place: filters.place || undefined,
      location: filters.location || undefined,
      city: filters.city || undefined,
      state: filters.state || undefined,
      country: filters.country || undefined,
      brixMin: hasCustomBrixRange ? filters.brixRange?.[0] : undefined,
      brixMax: hasCustomBrixRange ? filters.brixRange?.[1] : undefined,
      dateStart: filters.dateRange?.[0] || undefined,
      dateEnd: filters.dateRange?.[1] || undefined,
      search: searchTerm || undefined,
      sortBy: serverSortBy,
      sortOrder,
    };

    return q;
  }, [filters, searchTerm, sortBy, sortOrder]);

  const submissionsCountQuery = useFormattedSubmissionsCountQuery(countQuery);
  const totalCount = submissionsCountQuery.data ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  // Calculate which chunk we're on and set offset for db query
  const chunkIndex = Math.floor(((currentPage - 1) * itemsPerPage) / chunkSize);
  const chunkOffset = chunkIndex * chunkSize;
  const inChunkStart = ((currentPage - 1) * itemsPerPage) - chunkOffset;

  const pageQuery = useMemo(() => {
    return {
      ...countQuery,
      limit: chunkSize,
      offset: chunkOffset,
    };
  }, [countQuery, chunkOffset]);

  const submissionsPageQuery = useFormattedSubmissionsPageQuery(pageQuery);
  const chunkData = submissionsPageQuery.data || [];

 // Determine if we should prefetch the next chunk
  const shouldPrefetchNextChunk =
    // Is there any data?
    totalCount > 0 &&
    // Are we at the end of a chunk?
    (currentPage * itemsPerPage) % chunkSize === 0 &&
    // Is there more data to fetch?
    chunkOffset + chunkSize < totalCount;

  const nextPageQuery = useMemo(() => {
    return {
      ...countQuery,
      limit: chunkSize,
      offset: chunkOffset + chunkSize,
    };
  }, [countQuery, chunkOffset]);

  useEffect(() => {
    if (!shouldPrefetchNextChunk) return;

    queryClient.prefetchQuery({
      queryKey: ["submissions", "public_formatted", "page", nextPageQuery],
      queryFn: () => fetchFormattedSubmissionsPage(nextPageQuery),
      staleTime: 60 * 60 * 1000,
    });
  }, [nextPageQuery, queryClient, shouldPrefetchNextChunk]);

  const [showFilters, setShowFilters] = useState(false);

  // Queries for searching within filter popovers
  const [cropCategoryQuery, setCropCategoryQuery] = useState('');
  const [brandQuery, setBrandQuery] = useState('');
  // Refactored state from 'storeQuery' to 'locationQuery'
  const [locationQuery, setLocationQuery] = useState('');
  const [cropQuery, setCropQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<BrixDataPoint | null>(null);
  const [fromLeaderboard, setFromLeaderboard] = useState(false);

  // Apply URL filters on component mount
  useEffect(() => {
    if (!urlFiltersApplied && searchParams.toString()) {
      console.log(' Raw URL search params:', searchParams.toString());
      const urlFilters = parseURLSearchParams(searchParams);
      console.log(' Parsed URL filters:', urlFilters);
      
      if (Object.keys(urlFilters).length > 0) {
        const mergedFilters = mergeFiltersWithDefaults(urlFilters);
        console.log(' Merged filters being applied:', mergedFilters);
        setFilters(mergedFilters);
        setUrlFiltersApplied(true);
        setFromLeaderboard(true);
        // Keep URL params for debugging - don't clear them immediately
        // setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, urlFiltersApplied, setFilters, setSearchParams]);

  // Use a single useEffect to fetch submissions and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        const categories = await fetchCropCategories();
        setAvailableCategories(categories);
      } catch (err) {
        console.error('Error fetching data:', err);
        setAvailableCategories([]);
      }
    };
    loadData();
  }, []);

  // Reset to first page whenever filters or search terms change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    setFilteredCount(totalCount);
  }, [setFilteredCount, totalCount]);

  const currentItems = useMemo(() => {
    const endIndex = inChunkStart + itemsPerPage;
    return chunkData.slice(inChunkStart, endIndex);
  }, [chunkData, inChunkStart]);

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSort = (column: keyof BrixDataPoint) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleFilterChange = (filterName: keyof MapFilter, value: any) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const addCropType = (crop: string) => {
    setFilters(prev => {
      if (!prev.cropTypes.includes(crop)) {
        return { ...prev, cropTypes: [...prev.cropTypes, crop] };
      }
      return prev;
    });
  };
  const removeCropType = (crop: string) => {
    setFilters(prev => ({
      ...prev,
      cropTypes: prev.cropTypes.filter(c => c !== crop)
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_MAP_FILTERS);
    setSearchTerm('');
    setCropCategoryQuery('');
    setBrandQuery('');
    // Refactored state from 'setStoreQuery' to 'setLocationQuery'
    setLocationQuery('');
    setCropQuery('');
    setFromLeaderboard(false);
  };

  const filteredCategories = useMemo(() =>
    availableCategories.filter(cat =>
      cat.toLowerCase().includes(cropCategoryQuery.toLowerCase())
    ), [availableCategories, cropCategoryQuery]);

  const filteredBrands = useMemo(() =>
    brands.filter(brand =>
      (brand.label || brand.name).toLowerCase().includes(brandQuery.toLowerCase())
    ), [brands, brandQuery]);

  // Refactored memoized filter from `filteredStores` to `filteredLocations`
  const filteredLocations = useMemo(() =>
    locations.filter(location =>
      (location.label || location.name).toLowerCase().includes(locationQuery.toLowerCase())
    ), [locations, locationQuery]);

  const filteredCrops = useMemo(() =>
    crops.filter(crop =>
      crop.name.toLowerCase().includes(cropQuery.toLowerCase())
    ), [crops, cropQuery]);

  const filterSummary = getFilterSummary(filters, isAdmin);

  const handleOpenModal = (dataPoint: BrixDataPoint) => {
    setSelectedDataPoint(dataPoint);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDataPoint(null);
  };

  const handleUpdateSuccess = (updatedData: BrixDataPoint) => {
    queryClient.invalidateQueries({ queryKey: ['submissions', 'public_formatted'] });
    setSelectedDataPoint(updatedData);
  };

  const handleDeleteSuccess = (deletedId: string) => {
    queryClient.invalidateQueries({ queryKey: ['submissions', 'public_formatted'] });
    handleCloseModal();
  };

  if (submissionsPageQuery.isLoading || submissionsCountQuery.isLoading || isLoadingStaticData) {
    return (
      <div className="text-center py-12 text-text-dark flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-green-mid" />
        Loading data...
      </div>
    );
  }

  if (submissionsPageQuery.error || submissionsCountQuery.error) {
    return (
      <div className="text-center py-12 text-destructive">Error: Failed to load data.</div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-text-dark">All Submissions</h2>
          <p className="text-text-dark mt-1">Browse community measurements across crops and locations</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={cooldownSeconds > 0}
          className="flex items-center gap-2 border-green-pale text-green-deep hover:bg-green-mist"
        >
          <RefreshCw className={`w-4 h-4 ${submissionsPageQuery.isFetching ? 'animate-spin' : ''}`} />
          {cooldownSeconds > 0 ? `Refresh (${cooldownSeconds}s)` : 'Refresh'}
        </Button>
      </div>

      {fromLeaderboard && (
        <div className="mb-4 p-3 bg-green-mist border border-green-pale rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-text-dark text-sm">
              Showing filtered results from leaderboard selection
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromLeaderboard(false);
                navigate('/leaderboard');
              }}
              className="text-green-fresh hover:text-green-mid"
            >
              ← Back to Leaderboard
            </Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-green" />
          <Input
            placeholder="Search by crop, submitter, location, notes..."
            className="pl-9 pr-3 py-2 rounded-md border border-green-pale focus-visible:ring-green-fresh/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 border-green-pale text-green-deep hover:bg-green-mist"
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
        <Card className="mb-6 rounded-2xl border border-green-pale shadow-sm">
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Crop Types</Label>
              {filters.cropTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3" aria-label="Selected crop types">
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
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">BRIX Range</Label>
              <BrixRangeSlider
                brixRange={filters.brixRange}
                onChange={(newRange) => {
                  if (newRange[0] <= newRange[1]) {
                    handleFilterChange('brixRange', newRange);
                  }
                }}
              />
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Date Range
              </Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="start-date-data" className="text-xs">From</Label>
                  <Input
                    id="start-date-data"
                    type="date"
                    value={filters.dateRange[0]}
                    onChange={(e) =>
                      handleFilterChange('dateRange', [e.target.value, filters.dateRange[1]])
                    }
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
                    onChange={(e) =>
                      handleFilterChange('dateRange', [filters.dateRange[0], e.target.value])
                    }
                    className="text-sm"
                    aria-label="End date"
                  />
                </div>
              </div>
            </div>


            <div>
              <Label className="text-sm font-medium mb-2 block">Brand/Farm Name</Label>
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
                  <Button
                    variant="outline"
                    className="w-full justify-between text-sm"
                    aria-haspopup="listbox"
                  >
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
                      {filteredLocations.map((location) => (
                        <CommandItem
                          key={location.id}
                           onSelect={() => {
                             const locationValue = location.label || location.name;
                             handleFilterChange('place', locationValue === filters.place ? '' : locationValue);
                             setLocationQuery('');
                           }}
                          aria-selected={filters.place === location.name}
                          role="option"
                          className="flex justify-between items-center"
                        >
                           <span>{location.label || location.name}</span>
                           {filters.place === (location.label || location.name) && <Check className="h-4 w-4" />}
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
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
              <div className="flex items-center justify-between">
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
          </CardContent>
        </Card>
      )}

      {filterSummary !== 'No active filters' && (
        <p className="text-sm text-text-dark mb-4">
          Applying filters: <span className="font-semibold">{filterSummary}</span>
        </p>
      )}

      <Card className="rounded-2xl border border-green-pale shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden desktop:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-green-pale">
                  <TableHead
                    className="text-xs text-text-muted-green uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('cropType')}
                  >
                    Crop {sortBy === 'cropType' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-green uppercase tracking-wider">
                    Variety
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-green uppercase tracking-wider">
                    Brand
                  </TableHead>
                  <TableHead
                    className="text-xs text-text-muted-green uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('locationName')}
                  >
                    Location {sortBy === 'locationName' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead
                    className="text-xs text-text-muted-green uppercase tracking-wider text-center cursor-pointer"
                    onClick={() => handleSort('brixLevel')}
                  >
                    BRIX {sortBy === 'brixLevel' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-green uppercase tracking-wider">
                    Notes
                  </TableHead>
                  <TableHead
                    className="text-xs text-text-muted-green uppercase tracking-wider whitespace-nowrap cursor-pointer"
                    onClick={() => handleSort('submittedAt')}
                  >
                    Date {sortBy === 'submittedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="text-xs text-text-muted-green uppercase tracking-wider text-center">Verified?</TableHead>
                  <TableHead className="text-xs text-text-muted-green uppercase tracking-wider text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-text-mid">
                      No data found for the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((submission) => {
                    const isOwner = user?.id === submission.userId;
                    const canDeleteByOwner = (isOwner && !submission.verified) || isAdmin;

                    return (
                      <SubmissionTableRow
                        key={submission.id}
                        submission={submission}
                        onDelete={() => handleOpenModal(submission)}
                        isOwner={isOwner}
                        canDeleteByOwner={canDeleteByOwner}
                        onOpenModal={handleOpenModal}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile card list */}
          <div className="desktop:hidden space-y-3 p-4">
            {currentItems.length === 0 ? (
              <p className="text-center py-8 text-text-mid">No data found for the current filters.</p>
            ) : (
              currentItems.map((submission) => (
                <MobileSubmissionCard
                  key={submission.id}
                  submission={submission}
                  isOwner={user?.id === submission.userId}
                  onOpenModal={() => handleOpenModal(submission)}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-6">
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="border-green-pale hover:bg-green-mist"
        >
          <ChevronLeft className="w-4 h-4 mr-2" /> Previous
        </Button>
        <span className="text-sm text-text-dark">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="border-green-pale hover:bg-green-mist"
        >
          Next <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <DataPointDetailModal
        dataPoint={selectedDataPoint}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDeleteSuccess={handleDeleteSuccess}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </div>
  );
};

export default DataTable;