import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import Header from "../components/Layout/Header";
import { PageBackground } from '../components/ui/PageBackground';
import LocationSelector from "../components/common/LocationSelector";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { fetchCropTypes, CropType } from "../lib/fetchCropTypes";
import { fetchLocations, Location } from "../lib/fetchLocations";
import {
  fetchLocationLeaderboard,
  fetchBrandLeaderboard,
  fetchUserLeaderboard,
  LeaderboardEntry,
} from "../lib/fetchLeaderboards";
import { ALL_COUNTRIES } from "../lib/locationConstants";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { locationService } from "../lib/locationServiceforRegister";
import { LeaderboardCard } from "../components/leaderboard/LeaderboardCard";

const emptyLocation = {
  country: "",
  countryCode: "",
  state: "",
  stateCode: "",
  city: "",
};

const PAGE_SIZE = 20;

// Component

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState(() => ({
    ...emptyLocation,
    country: user?.country || ALL_COUNTRIES,
    state: user?.state || "",
    city: user?.city || "",
  }));
  const [crop, setCrop] = useState("");
  const [allCrops, setAllCrops] = useState<CropType[]>([]);
  const [store, setStore] = useState("");
  const [allStores, setAllStores] = useState<Location[]>([]);

  const [locationData, setLocationData] = useState<LeaderboardEntry[]>([]);
  const [brandData, setBrandData] = useState<LeaderboardEntry[]>([]);
  const [userData, setUserData] = useState<LeaderboardEntry[]>([]);

  const [locationFetchFilters, setLocationFetchFilters] = useState<any>(null);
  const [brandFetchFilters, setBrandFetchFilters] = useState<any>(null);
  const [userFetchFilters, setUserFetchFilters] = useState<any>(null);

  const [locationHasMore, setLocationHasMore] = useState(false);
  const [brandHasMore, setBrandHasMore] = useState(false);
  const [userHasMore, setUserHasMore] = useState(false);

  const [loadingMore, setLoadingMore] = useState({ location: false, brand: false, user: false });

  const [brandScope, setBrandScope] = useState<'city' | 'state' | 'country' | 'global'>('city');
  const [dataScopeMessage, setDataScopeMessage] = useState("");

  // Mobile-only: which board the segmented control is showing (≤640px).
  // Desktop renders all three boards regardless of this value.
  const [mobileTab, setMobileTab] = useState<'location' | 'brand' | 'user'>('location');

  // Two distinct loading modes:
  //   isFirstLoad  — no data yet, show skeleton rows
  //   isFetching   — filter change, keep stale data visible (dimmed)
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Initializing location codes — we handle this silently (no spinner)
  const [isInitializing, setIsInitializing] = useState(!!user?.country);

  // Allow refresh whenever a fetch isn't already in flight (no fixed cooldown).
  const canRefresh = !isFetching && !isFirstLoad;
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Init location codes from GeoNames

  useEffect(() => {
    if (!user?.country) {
      setIsInitializing(false);
      return;
    }

    let mounted = true;
    const init = async () => {
      try {
        const countries = await locationService.getCountries();
        const userCountry = countries.find(
          (c) => c.name.toLowerCase() === user.country!.toLowerCase()
        );
        const countryCode = userCountry?.code || "";

        let stateCode = "";
        if (countryCode && user.state) {
          try {
            const states = await locationService.getStates(countryCode);
            const userState = states.find(
              (s) => s.name.toLowerCase() === user.state!.toLowerCase()
            );
            stateCode = userState?.adminCode1 || "";
          } catch { /* non-fatal */ }
        }

        if (mounted) {
          setLocation({
            country: userCountry?.name || user.country,
            countryCode,
            state: user.state || "",
            stateCode,
            city: user.city || "",
          });
        }
      } catch {
        if (mounted) {
          setLocation((l) => ({
            ...l,
            country: user!.country || "",
            state: user!.state || "",
            city: user!.city || "",
          }));
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [user]);

  // Load crop types

  useEffect(() => {
    fetchCropTypes()
      .then((crops) => setAllCrops(crops || []))
      .catch(() => {});
  }, []);

  // Load stores (venues) for the store filter (same pattern as crops)

  useEffect(() => {
    fetchLocations()
      .then((stores) => setAllStores(stores || []))
      .catch(() => {});
  }, []);

  // Fetch leaderboards

  useEffect(() => {
    if (isInitializing) return;

    let mounted = true;

    const run = async () => {
      // First load: show skeletons. Subsequent: dim existing data.
      if (isFirstLoad) {
        setIsFetching(false);
      } else {
        setIsFetching(true);
      }
      setDataScopeMessage("");

      try {
        const fetchLoc = (f: any) =>
          queryClient.fetchQuery({
            queryKey: ['leaderboard', 'location', f],
            queryFn: () => fetchLocationLeaderboard(f),
            staleTime: 5 * 60 * 1000,
          });

        const fetchBrand = (f: any) =>
          queryClient.fetchQuery({
            queryKey: ['leaderboard', 'brand', f],
            queryFn: () => fetchBrandLeaderboard(f),
            staleTime: 5 * 60 * 1000,
          });

        const fetchUsers = (f: any) =>
          queryClient.fetchQuery({
            queryKey: ['leaderboard', 'user', f],
            queryFn: () => fetchUserLeaderboard(f),
            staleTime: 5 * 60 * 1000,
          });

        let filters: any = {
          country: location.country || undefined,
          state: location.state || undefined,
          city: location.city || undefined,
          crop: crop || undefined,
          store: store || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        };
        const userFilters = { crop: crop || undefined, store: store || undefined, limit: PAGE_SIZE, offset: 0 };

        // Fetch all three in parallel on first attempt
        let [loc, brand, users] = await Promise.all([
          fetchLoc(filters),
          fetchBrand(filters),
          fetchUsers(userFilters),
        ]);

        let scope: typeof brandScope = 'city';

        // Fallback: broaden scope if both location and brand are empty
        if (mounted && !loc.length && !brand.length && filters.city) {
          filters = { ...filters, city: undefined };
          scope = 'state';
          [loc, brand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          if (loc.length || brand.length) {
            setDataScopeMessage(
              `Showing state-level data for ${filters.state}, ${filters.country} (no data for ${location.city})`
            );
          }
        }

        if (mounted && !loc.length && !brand.length && filters.state) {
          filters = { ...filters, state: undefined };
          scope = 'country';
          [loc, brand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          if (loc.length || brand.length) {
            setDataScopeMessage(
              `Showing country-level data for ${filters.country} (no data for ${location.state})`
            );
          }
        }

        if (mounted && !loc.length && !brand.length) {
          filters = { country: undefined, state: undefined, city: undefined, crop: crop || undefined, store: store || undefined, limit: PAGE_SIZE, offset: 0 };
          scope = 'global';
          [loc, brand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          if (loc.length || brand.length) {
            setDataScopeMessage("Showing global data (no regional data found)");
          }
        }

        if (mounted) {
          setLocationData(loc || []);
          setBrandData(brand || []);
          setUserData(users || []);
          setBrandScope(scope);
          setLocationFetchFilters(filters);
          setBrandFetchFilters(filters);
          setUserFetchFilters(userFilters);
          setLocationHasMore(Array.isArray(loc) && loc.length === PAGE_SIZE);
          setBrandHasMore(Array.isArray(brand) && brand.length === PAGE_SIZE);
          setUserHasMore(Array.isArray(users) && users.length === PAGE_SIZE);
          setIsFirstLoad(false);
        }
      } catch (err) {
        console.error("Error loading leaderboards:", err);
      } finally {
        if (mounted) setIsFetching(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [location, crop, store, isInitializing, refreshNonce]);

  // Handlers

  const handleRefresh = () => {
    if (!canRefresh) return;
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    setRefreshNonce((n) => n + 1);
  };

  // Restore the personalized default view (my location, all crops). Showing all
  // countries is reachable directly via the Country dropdown, so one reset suffices.
  const resetFilters = () => {
    setLocation({ ...emptyLocation, country: user?.country || ALL_COUNTRIES, state: user?.state || "", city: user?.city || "" });
    setCrop("");
    setStore("");
  };

  const loadMore = async (type: 'location' | 'brand' | 'user') => {
    const filters = type === 'location' ? locationFetchFilters
      : type === 'brand' ? brandFetchFilters
      : userFetchFilters;
    if (!filters) return;

    setLoadingMore((s) => ({ ...s, [type]: true }));
    try {
      const currentLen = type === 'location' ? locationData.length
        : type === 'brand' ? brandData.length
        : userData.length;

      const nextFilters = { ...filters, limit: PAGE_SIZE, offset: currentLen };
      const queryFn = type === 'location' ? () => fetchLocationLeaderboard(nextFilters)
        : type === 'brand' ? () => fetchBrandLeaderboard(nextFilters)
        : () => fetchUserLeaderboard(nextFilters);

      const nextPage = await queryClient.fetchQuery({
        queryKey: ['leaderboard', type, nextFilters],
        queryFn,
        staleTime: 5 * 60 * 1000,
      });
      const nextArr = Array.isArray(nextPage) ? nextPage : [];

      if (type === 'location') {
        setLocationData((p) => [...p, ...nextArr]);
        setLocationHasMore(nextArr.length === PAGE_SIZE);
      } else if (type === 'brand') {
        setBrandData((p) => [...p, ...nextArr]);
        setBrandHasMore(nextArr.length === PAGE_SIZE);
      } else {
        setUserData((p) => [...p, ...nextArr]);
        setUserHasMore(nextArr.length === PAGE_SIZE);
      }
    } finally {
      setLoadingMore((s) => ({ ...s, [type]: false }));
    }
  };

  const handleNavigate = (entry: any, leaderboardType: 'location' | 'brand' | 'user') => {
    if (leaderboardType === "user") return;

    const filters: Record<string, string> = {};

    if (leaderboardType === 'location') {
      const locationName = entry.location_label || entry.location_name;
      if (locationName) filters.location = locationName;
      if (entry.city) filters.city = entry.city;
      if (entry.state) filters.state = entry.state;
      if (entry.country) filters.country = entry.country;
      if (crop) filters.crop = crop;
    } else if (leaderboardType === 'brand') {
      const brandName = entry.brand_label || entry.brand_name;
      if (brandName) filters.brand = brandName;
      if (crop) filters.crop = crop;
      switch (brandScope) {
        case 'city':
          if (location?.country && location.country !== ALL_COUNTRIES) filters.country = location.country;
          if (location?.state) filters.state = location.state;
          if (location?.city) filters.city = location.city;
          break;
        case 'state':
          if (location?.country && location.country !== ALL_COUNTRIES) filters.country = location.country;
          if (location?.state) filters.state = location.state;
          break;
        case 'country':
          if (location?.country && location.country !== ALL_COUNTRIES) filters.country = location.country;
          break;
      }
    }

    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, v]) => v?.trim())
    ).toString();
    navigate(`/data?${params}`);
  };

  // Render

  // One merged surface: a single bordered/rounded/shadowed panel whose internal
  // regions are split by hairline dividers (no gaps with background showing).
  const PANEL = "bg-card text-card-foreground border border-hairline rounded-2xl shadow-sm overflow-hidden";

  const boardConfigs = [
    { key: 'location' as const, title: 'Top Locations', subtitle: 'Where the highest-scoring produce is being found', data: locationData, hasMore: locationHasMore, isLoadingMore: loadingMore.location, onLoadMore: () => loadMore('location') },
    { key: 'brand' as const, title: 'Top Brands', subtitle: 'Farms and brands with the best average scores', data: brandData, hasMore: brandHasMore, isLoadingMore: loadingMore.brand, onLoadMore: () => loadMore('brand') },
    { key: 'user' as const, title: 'Most Submissions', subtitle: 'The community’s most active contributors', data: userData, hasMore: userHasMore, isLoadingMore: loadingMore.user, onLoadMore: () => loadMore('user') },
  ];
  const filterTabs = ([
    { key: 'location', label: 'Locations' },
    { key: 'brand', label: 'Brands' },
    { key: 'user', label: 'Submissions' },
  ] as const);
  const renderBoard = (cfg: typeof boardConfigs[number]) => (
    <LeaderboardCard
      title={cfg.title}
      subtitle={cfg.subtitle}
      data={cfg.data}
      labelKey={cfg.key}
      loadMoreType={cfg.key}
      hasMore={cfg.hasMore}
      isFirstLoad={isFirstLoad}
      isFetching={isFetching}
      isLoadingMore={cfg.isLoadingMore}
      onLoadMore={cfg.onLoadMore}
      onNavigate={handleNavigate}
    />
  );

  return (
    <PageBackground className="min-h-screen flex flex-col">
      {isFirstLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading leaderboards...</p>
          </div>
        </div>
      )}
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {/* Page identity, shown on both mobile and desktop. Refresh lives here
            (data freshness, not a filter) so it sits with the section, not the filters. */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-display font-bold text-on-bg-text">
              Leaderboard
            </h1>
            <p className="mt-1 text-on-bg-body">
              See where the community is finding the most nutritious produce, ranked by location, brand, and contributor.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={!canRefresh}
            aria-label="Refresh leaderboards"
            className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg ${canRefresh ? 'text-on-bg-body hover:text-on-bg-text hover:bg-white/10' : 'text-on-bg-muted'}`}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {/* ── Mobile (≤640px): one merged panel — filters · tabs · active board ── */}
        <div className={`lb-mobile-only -mx-1 mb-4 ${PANEL}`}>
          {/* Filters region */}
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              <LocationSelector value={location} onChange={setLocation} required={false} showAutoDetect={false} />
              <div>
                <label className="block text-sm font-medium text-text-dark mb-1">Crop</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-card text-text-dark text-sm px-2 py-2"
                >
                  <option value="">All crops</option>
                  {allCrops.map((c) => (
                    <option key={c.id} value={c.name}>
                      {(c.label || c.name).replace(/\b\w/g, ch => ch.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-text-dark mb-1">Store</label>
                <select
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  className="w-full rounded-lg border border-hairline bg-card text-text-dark text-sm px-2 py-2"
                >
                  <option value="">All stores</option>
                  {allStores.map((s) => (
                    <option key={s.id} value={s.name}>
                      {(s.label || s.name).replace(/\b\w/g, ch => ch.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm">
              <button onClick={resetFilters} className="text-text-mid hover:text-text-dark">
                Reset filters
              </button>
            </div>
          </div>
          {/* Tabs region */}
          <div className="px-3 py-3 border-t border-hairline">
            <div className="flex gap-1 p-1 bg-surface-canvas border border-hairline rounded-xl">
              {filterTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setMobileTab(t.key)}
                  aria-pressed={mobileTab === t.key}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mobileTab === t.key
                      ? 'bg-card text-card-foreground border border-blue-light shadow-sm'
                      : 'text-blue-mid'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {dataScopeMessage && (
            <div className="px-3 py-2 border-t border-hairline bg-surface-canvas text-sm text-text-mid">{dataScopeMessage}</div>
          )}
          {/* Active board region (others hidden by .lb-board) */}
          {boardConfigs.map((cfg) => (
            <div key={cfg.key} className={`border-t border-hairline lb-board ${mobileTab === cfg.key ? 'lb-board--active' : ''}`}>
              {renderBoard(cfg)}
            </div>
          ))}
        </div>

        {/* ── Desktop (≥641px): one merged panel, filters then boards (no gap) ── */}
        <div className={`lb-desktop-only ${PANEL}`}>
          {/* Filters region */}
          <div className="p-4">
            <h2 className="text-lg font-semibold font-display text-text-dark mb-3">Filters</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
              <LocationSelector
                value={location}
                onChange={setLocation}
                required={false}
                showAutoDetect={false}
              />
              <div>
                <Label htmlFor="crop">Crop</Label>
                <Select value={crop || "all"} onValueChange={(v) => setCrop(v === "all" ? "" : v)}>
                  <SelectTrigger id="crop" className="mt-1 px-4">
                    <SelectValue placeholder="All crops" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All crops</SelectItem>
                    {allCrops.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {(c.label || c.name).replace(/\b\w/g, ch => ch.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="store">Store</Label>
                <Select value={store || "all"} onValueChange={(v) => setStore(v === "all" ? "" : v)}>
                  <SelectTrigger id="store" className="mt-1 px-4">
                    <SelectValue placeholder="All stores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stores</SelectItem>
                    {allStores.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {(s.label || s.name).replace(/\b\w/g, ch => ch.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={resetFilters}
                className="text-sm text-text-mid hover:text-text-dark"
              >
                Reset filters
              </button>
            </div>
          </div>

          {dataScopeMessage && (
            <div className="px-4 py-3 border-t border-hairline bg-surface-canvas text-sm text-text-mid">
              {dataScopeMessage}
            </div>
          )}

          {/* Boards split from filters and each other by hairline dividers */}
          {boardConfigs.map((cfg) => (
            <div key={cfg.key} className="border-t border-hairline">
              {renderBoard(cfg)}
            </div>
          ))}
        </div>
      </main>
    </PageBackground>
  );
};

export default LeaderboardPage;
