import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Loader2 } from "lucide-react";
import Header from "../components/Layout/Header";
import LocationSelector from "../components/common/LocationSelector";
import { fetchCropTypes, CropType } from "../lib/fetchCropTypes";
import {
  fetchLocationLeaderboard,
  fetchBrandLeaderboard,
  fetchUserLeaderboard,
  LeaderboardEntry,
} from "../lib/fetchLeaderboards";
import { ALL_COUNTRIES } from "../lib/locationConstants";
import { useQueryClient } from "@tanstack/react-query";
import { computeNormalizedScore } from "../lib/getBrixColor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { locationService } from "../lib/locationServiceforRegister";
import { formatUsername } from "../lib/formatUsername";

const emptyLocation = {
  country: "",
  countryCode: "",
  state: "",
  stateCode: "",
  city: "",
};

const PAGE_SIZE = 20;

// ─── Component ────────────────────────────────────────────────────────────────

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState(() => ({
    ...emptyLocation,
    country: user?.country || "",
    state: user?.state || "",
    city: user?.city || "",
  }));
  const [crop, setCrop] = useState("");
  const [allCrops, setAllCrops] = useState<CropType[]>([]);

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

  // Two distinct loading modes:
  //   isFirstLoad  — no data yet, show skeleton rows
  //   isFetching   — filter change, keep stale data visible (dimmed)
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Initializing location codes — we handle this silently (no spinner)
  const [isInitializing, setIsInitializing] = useState(!!user?.country);

  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const canRefresh = Date.now() - lastRefreshAt >= 15_000;
  const [refreshNonce, setRefreshNonce] = useState(0);

  // ─── Init location codes from GeoNames ──────────────────────────────────────

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

  // ─── Load crop types ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCropTypes()
      .then((crops) => setAllCrops(crops || []))
      .catch(() => {});
  }, []);

  // ─── Fetch leaderboards ──────────────────────────────────────────────────────

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
          limit: PAGE_SIZE,
          offset: 0,
        };
        const userFilters = { crop: crop || undefined, limit: PAGE_SIZE, offset: 0 };

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
          filters = { country: undefined, state: undefined, city: undefined, crop: crop || undefined, limit: PAGE_SIZE, offset: 0 };
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
  }, [location, crop, isInitializing, refreshNonce]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    if (!canRefresh) return;
    setLastRefreshAt(Date.now());
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    setRefreshNonce((n) => n + 1);
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
          if (location?.country) filters.country = location.country;
          if (location?.state) filters.state = location.state;
          if (location?.city) filters.city = location.city;
          break;
        case 'state':
          if (location?.country) filters.country = location.country;
          if (location?.state) filters.state = location.state;
          break;
        case 'country':
          if (location?.country) filters.country = location.country;
          break;
      }
    }

    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, v]) => v?.trim())
    ).toString();
    navigate(`/data?${params}`);
  };

  // ─── Render card ─────────────────────────────────────────────────────────────

  const renderLeaderboardCard = (
    title: string,
    data: LeaderboardEntry[],
    labelKey: string,
    loadMoreType: 'location' | 'brand' | 'user',
    hasMore: boolean
  ) => (
    <Card className="w-full border border-green-pale rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold font-display text-text-dark text-center">{title}</CardTitle>
        {labelKey === "user" && (
          <p className="text-sm text-muted-foreground text-center mt-1">
            Global rankings • All users
          </p>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className={isFirstLoad || isFetching ? 'opacity-50 pointer-events-none' : ''}>
            {data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-sm text-text-muted-green">No data available.</div>
            ) : (
              <div>
                <div className="grid grid-cols-3 text-xs font-medium text-text-muted-green uppercase tracking-wider border-b border-green-pale px-4 py-2 bg-table-header">
                  <span className="text-left">
                    {labelKey === "location" ? "Store" : "Name"}
                  </span>
                  <span className="text-center">
                    {labelKey === "user" ? "Submissions" : "Score"}
                  </span>
                  <span className="text-center">Rank</span>
                </div>

                <div>
                  {(() => {
                    const rankCounts = data.reduce((acc, entry) => {
                      const r = entry.rank ?? 0;
                      acc[r] = (acc[r] || 0) + 1;
                      return acc;
                    }, {} as Record<number, number>);

                    return data.map((entry, idx) => {
                      const label =
                        (entry as any)[`${labelKey}_label`] ||
                        (entry as any)[`${labelKey}_name`] ||
                        (entry as any).user_name ||
                        (entry as any).display_name ||
                        (entry as any).entity_name ||
                        "Unknown";

                      const score = entry.average_normalized_score ?? null;
                      const normalizedScore =
                        typeof score === "number"
                          ? score
                          : (() => {
                              const avgBrix = entry.average_brix;
                              return typeof avgBrix === "number"
                                ? computeNormalizedScore(avgBrix)
                                : 1.5;
                            })();

                      const rank = entry.rank ?? idx + 1;
                      const isTie = rankCounts[rank] > 1;
                      const getBadgeClasses = () => {
                        if (labelKey === "user") return "bg-badge-neutral-bg text-badge-neutral-text";
                        if (normalizedScore >= 16) return "bg-green-pale text-green-mid";
                        if (normalizedScore >= 8) return "bg-[var(--badge-gold-bg)] text-[var(--badge-gold-text)]";
                        if (normalizedScore >= 4) return "bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)]";
                        return "bg-badge-neutral-bg text-badge-neutral-text";
                      };
                      const badgeClasses = getBadgeClasses();

                      return (
                        <div
                          key={(entry as any)[`${labelKey}_id`] ?? label ?? idx}
                          onClick={() => handleNavigate(entry, labelKey as 'location' | 'brand' | 'user')}
                          className={`grid grid-cols-3 items-center px-4 py-2 border-b border-green-pale last:border-0 odd:bg-card even:bg-table-stripe hover:bg-table-stripe transition-colors text-sm ${
                            labelKey !== "user" ? "cursor-pointer" : ""
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="font-medium text-text-dark">{labelKey === 'user' ? formatUsername(label) : label}</div>
                            {labelKey === "location" && (
                              <div className="text-xs text-text-muted-green">
                                {(entry as any).city
                                  ? `${(entry as any).city}${(entry as any).state ? `, ${(entry as any).state}` : ""}`
                                  : ""}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-text-muted-green">
                              {entry.submission_count ?? 0} submissions
                            </div>
                          </div>

                          <div className="text-center text-text-dark font-display font-bold text-sm">
                            {labelKey === "user"
                              ? entry.submission_count ?? 0
                              : Number(normalizedScore ?? 0).toFixed(2)}
                          </div>

                          <div className="flex flex-col items-center">
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badgeClasses}`}>
                              {rank}
                            </span>
                            {isTie && (
                              <span className="text-xs text-text-muted-green mt-1">(tie)</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {hasMore && (
                  <div className="p-3 border-t border-green-pale">
                    <button
                      onClick={() => loadMore(loadMoreType)}
                      disabled={loadingMore[loadMoreType]}
                      className="w-full flex items-center justify-center gap-2 text-sm text-green-fresh hover:text-green-mid disabled:text-text-muted-green"
                    >
                      <span>{loadingMore[loadMoreType] ? 'Loading…' : 'Load more'}</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {isFirstLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading leaderboards...</p>
          </div>
        </div>
      )}
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Filters sidebar */}
          <aside className="w-full md:w-72">
            <div className="bg-card border border-green-pale rounded-2xl shadow-sm p-4">
            <h2 className="text-lg font-semibold font-display text-text-dark mb-4">Filters</h2>
            <div className="space-y-4">
              <button
                onClick={handleRefresh}
                disabled={!canRefresh}
                className={`text-sm ${canRefresh ? 'text-green-fresh hover:text-green-mid' : 'text-text-muted-green'} text-left`}
              >
                Refresh Leaderboards
              </button>
              <LocationSelector
                value={location}
                onChange={setLocation}
                required={false}
                showAutoDetect={false}
              />
              <div>
                <label className="block text-sm font-medium text-text-dark mb-2">Crop</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-lg border border-green-pale bg-card text-text-dark px-2 py-2"
                >
                  <option value="">All crops</option>
                  {allCrops.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.label || c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => {
                    setLocation({
                      ...emptyLocation,
                      country: user?.country || "",
                      state: user?.state || "",
                      city: user?.city || "",
                    });
                    setCrop("");
                  }}
                  className="text-sm text-green-fresh hover:text-green-mid text-left"
                >
                  Reset to My Location
                </button>
                <button
                  onClick={() => {
                    setLocation({ ...emptyLocation, country: ALL_COUNTRIES });
                    setCrop("");
                  }}
                  className="text-sm text-text-mid hover:text-text-dark text-left"
                >
                  Clear Filters
                </button>
              </div>
            </div>
            </div>
          </aside>

          {/* Leaderboard grid */}
          <section className="flex-1">
            {dataScopeMessage && (
              <div className="mb-4 p-3 bg-green-mist border border-green-pale rounded-lg text-sm text-text-mid">
                {dataScopeMessage}
              </div>
            )}
            <div className="grid grid-cols-1 gap-6">
              {renderLeaderboardCard("Top Locations", locationData, "location", 'location', locationHasMore)}
              {renderLeaderboardCard("Top Brands", brandData, "brand", 'brand', brandHasMore)}
              {renderLeaderboardCard("Most Submissions", userData, "user", 'user', userHasMore)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LeaderboardPage;
