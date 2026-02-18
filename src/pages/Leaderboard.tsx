import React, { useEffect, useMemo, useState } from "react";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  computeNormalizedScore,
  rankColorFromNormalized,
} from "../lib/getBrixColor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useAuth } from "../contexts/AuthContext";
import { locationService } from "../lib/locationServiceforRegister";

const emptyLocation = {
  country: "",
  countryCode: "",
  state: "",
  stateCode: "",
  city: "",
};

const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pageSize = 20;

  const [location, setLocation] = useState(() => ({
    ...emptyLocation,
    country: user?.country || "",
    state: user?.state || "",
    city: user?.city || "",
  }));
  const [crop, setCrop] = useState("");
  const [allCrops, setAllCrops] = useState<CropType[]>([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataScopeMessage, setDataScopeMessage] = useState<string>("");

  const [locationData, setLocationData] = useState<LeaderboardEntry[]>([]);
  const [brandData, setBrandData] = useState<LeaderboardEntry[]>([]);
  const [userData, setUserData] = useState<LeaderboardEntry[]>([]);

  const [locationFetchFilters, setLocationFetchFilters] = useState<any | null>(null);
  const [brandFetchFilters, setBrandFetchFilters] = useState<any | null>(null);
  const [userFetchFilters, setUserFetchFilters] = useState<any | null>(null);

  const [locationHasMore, setLocationHasMore] = useState(false);
  const [brandHasMore, setBrandHasMore] = useState(false);
  const [userHasMore, setUserHasMore] = useState(false);

  const [loadingMore, setLoadingMore] = useState<{ location: boolean; brand: boolean; user: boolean }>({
    location: false,
    brand: false,
    user: false,
  });

  const [brandScope, setBrandScope] = useState<'city' | 'state' | 'country' | 'global'>('city');
  const [loading, setLoading] = useState<boolean>(false);

  const [lastRefreshAt, setLastRefreshAt] = useState<number>(0);
  const refreshCooldownMs = 15_000;
  const canRefresh = Date.now() - lastRefreshAt >= refreshCooldownMs;

  const [refreshNonce, setRefreshNonce] = useState(0);

  // Computed loading state for full page
  const isPageLoading = isInitializing || loading || cropsLoading;

  // Initialize codes for LocationSelector
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!user?.country) {
        if (mounted) setIsInitializing(false);
        return;
      }

      try {
        const countries = await locationService.getCountries();
        const userCountry = countries.find(
          (c) => c.name.toLowerCase() === user.country!.toLowerCase()
        );
        let countryCode = userCountry?.code || "";

        let stateCode = "";
        if (countryCode && user.state) {
          try {
            const states = await locationService.getStates(countryCode);
            const userState = states.find(
              (s) => s.name.toLowerCase() === user.state!.toLowerCase()
            );
            stateCode = userState?.adminCode1 || "";
          } catch (err) {
            console.warn("Error loading states:", err);
          }
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
      } catch (err) {
        console.error("Error initializing location:", err);
        if (mounted) {
          setLocation((l) => ({
            ...l,
            country: user.country || "",
            state: user.state || "",
            city: user.city || "",
          }));
        }
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [user]);

  // Load crop types
  useEffect(() => {
    const load = async () => {
      setCropsLoading(true);
      try {
        const crops = await fetchCropTypes();
        setAllCrops(crops || []);
      } catch (err) {
        console.error("Failed to load crops:", err);
      } finally {
        setCropsLoading(false);
      }
    };
    load();
  }, []);

  // Fetch leaderboards
  useEffect(() => {
    if (isInitializing) return;

    let mounted = true;
    const run = async () => {
      setLoading(true);
      setDataScopeMessage("");
      try {
        let filters = {
          country: location.country || undefined,
          state: location.state || undefined,
          city: location.city || undefined,
          crop,
          limit: pageSize,
          offset: 0,
        };
        let scope: 'city' | 'state' | 'country' | 'global' = 'city';

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

        // Fetch location and brand data with regional filters
        let [loc, brand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);

        // Always fetch users globally (ignore location filters)
        let users = await fetchUsers({ crop: filters.crop || undefined, limit: pageSize, offset: 0 });

        // fallback: broaden scope if locations and brands have nothing found
        if (
          mounted &&
          !loc.length &&
          !brand.length &&
          filters.city
        ) {
          filters = { ...filters, city: undefined };
          scope = 'state';
          const [newLoc, newBrand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          loc = newLoc;
          brand = newBrand;

          // Keep global users (no need to refetch)
          if (loc.length || brand.length) {
            setDataScopeMessage(
              `Showing state-level data for ${filters.state}, ${filters.country} (no data for ${location.city})`
            );
          }
        }

        if (
          mounted &&
          !loc.length &&
          !brand.length &&
          filters.state
        ) {
          filters = { ...filters, state: undefined };
          scope = 'country';
          const [newLoc, newBrand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          loc = newLoc;
          brand = newBrand;

          // Keep global users (no need to refetch)
          if (loc.length || brand.length) {
            setDataScopeMessage(
              `Showing country-level data for ${filters.country} (no data for ${location.state})`
            );
          }
        }

        if (mounted && !loc.length && !brand.length) {
          filters = { country: undefined, state: undefined, city: undefined, crop, limit: pageSize, offset: 0 };
          scope = 'global';
          const [newLoc, newBrand] = await Promise.all([fetchLoc(filters), fetchBrand(filters)]);
          loc = newLoc;
          brand = newBrand;

          // Keep global users (no need to refetch)
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
          setUserFetchFilters({ crop: filters.crop || undefined, limit: pageSize, offset: 0 });

          setLocationHasMore(Array.isArray(loc) && loc.length === pageSize);
          setBrandHasMore(Array.isArray(brand) && brand.length === pageSize);
          setUserHasMore(Array.isArray(users) && users.length === pageSize);
        }
      } catch (err) {
        console.error("Error loading leaderboards:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [location, crop, isInitializing, refreshNonce]);

  const handleRefresh = async () => {
    if (!canRefresh) return;
    setLastRefreshAt(Date.now());
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
    ]);

    setRefreshNonce((n) => n + 1);
  };

  const loadMore = async (type: 'location' | 'brand' | 'user') => {
    const filters = type === 'location'
      ? locationFetchFilters
      : type === 'brand'
        ? brandFetchFilters
        : userFetchFilters;

    if (!filters) return;

    setLoadingMore((s) => ({ ...s, [type]: true }));
    try {
      const currentLen = type === 'location'
        ? locationData.length
        : type === 'brand'
          ? brandData.length
          : userData.length;

      const nextFilters = { ...filters, limit: pageSize, offset: currentLen };

      const queryKey = ['leaderboard', type, nextFilters];
      const queryFn =
        type === 'location'
          ? () => fetchLocationLeaderboard(nextFilters)
          : type === 'brand'
            ? () => fetchBrandLeaderboard(nextFilters)
            : () => fetchUserLeaderboard(nextFilters);

      const nextPage = await queryClient.fetchQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000,
      });

      const nextArr = Array.isArray(nextPage) ? nextPage : [];

      if (type === 'location') {
        setLocationData((prev) => [...prev, ...nextArr]);
        setLocationHasMore(nextArr.length === pageSize);
      } else if (type === 'brand') {
        setBrandData((prev) => [...prev, ...nextArr]);
        setBrandHasMore(nextArr.length === pageSize);
      } else {
        setUserData((prev) => [...prev, ...nextArr]);
        setUserHasMore(nextArr.length === pageSize);
      }
    } finally {
      setLoadingMore((s) => ({ ...s, [type]: false }));
    }
  };

  const handleNavigate = (
    entry: any,
    leaderboardType: 'location' | 'brand' | 'user'
  ) => {
    if (leaderboardType === "user") return; // Users not clickable

    console.log('🔍 Navigation entry:', entry, 'type:', leaderboardType);

    const filters: Record<string, string> = {};

    if (leaderboardType === 'location') {
      // Location leaderboard returns: location_label, location_name, city, state, country
      const locationName = entry.location_label || entry.location_name;
      if (locationName) filters.location = locationName;

      // Use the geographic data from the leaderboard entry itself
      if (entry.city) filters.city = entry.city;
      if (entry.state) filters.state = entry.state;
      if (entry.country) filters.country = entry.country;
      if (crop) filters.crop = crop;
    } else if (leaderboardType === 'brand') {
      // Brand leaderboard returns: brand_label, brand_name
      const brandName = entry.brand_label || entry.brand_name;
      if (brandName) filters.brand = brandName;
      if (crop) filters.crop = crop;

      // Scope-aware geographic filters based on the breadth we fetched
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
        case 'global':
        default:
          // No geo filters
          break;
      }
    }

    console.log('🎯 Navigation filters being set:', filters);

    const params = new URLSearchParams(
      Object.entries(filters).filter(([_, v]) => v && v.trim() !== '')
    ).toString();

    console.log('🔗 Navigating to URL with params:', params);
    navigate(`/data?${params}`);
  };

  const renderLeaderboardCard = (
    title: string,
    data: LeaderboardEntry[],
    labelKey: string,
    loadMoreType: 'location' | 'brand' | 'user',
    hasMore: boolean
  ) => {
    return (
      <Card className="w-full shadow-md rounded-lg overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold text-center">
            {title}
          </CardTitle>
          {labelKey === "user" && (
            <p className="text-sm text-muted-foreground text-center mt-1">
              Global rankings • All users
            </p>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="text-sm text-gray-500 p-3">Loading…</div>
          ) : data.length === 0 ? (
            <div className="text-sm text-gray-500 p-3">No data available.</div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="grid grid-cols-3 text-xs font-medium text-gray-500 border-b px-4 py-2 bg-gray-50">
                <span className="text-left">
                  {labelKey === "location" ? "Store" : "Name"}
                </span>
                <span className="text-center">
                  {labelKey === "user" ? "Submissions" : "Score"}
                </span>
                <span className="text-center">Rank</span>
              </div>

              {/* Rows */}
              <div>
                {(() => {
                  // Create a map of ranks to count how many entries have that rank
                  const rankCounts = data.reduce((acc, entry) => {
                    const rank = entry.rank ?? 0;
                    acc[rank] = (acc[rank] || 0) + 1;
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

                    // Use neutral color for user rankings, normalized color for others
                    const { bgClass } = labelKey === "user"
                      ? { bgClass: "bg-gray-700" }
                      : rankColorFromNormalized(normalizedScore);

                    return (
                      <div
                        key={(entry as any)[`${labelKey}_id`] ?? label ?? idx}
                        onClick={() =>
                          handleNavigate(
                            entry,
                            labelKey as 'location' | 'brand' | 'user'
                          )
                        }
                        className={`grid grid-cols-3 items-center px-4 py-2 border-b last:border-0 odd:bg-white even:bg-gray-50 hover:bg-gray-100 text-sm ${
                          labelKey !== "user" ? "cursor-pointer" : ""
                        }`}
                      >
                        {/* Left: Label + details */}
                        <div className="flex flex-col min-w-0">
                          <div className="font-medium">{label}</div>
                          {labelKey === "location" && (
                            <div className="text-xs text-gray-500">
                              {(entry as any).city
                                ? `${(entry as any).city}${
                                    (entry as any).state
                                      ? `, ${(entry as any).state}`
                                      : ""
                                  }`
                                : ""}
                            </div>
                          )}
                          <div className="mt-1 text-xs text-gray-500 italic">
                            {entry.submission_count ?? 0} submissions
                          </div>
                        </div>

                        {/* Middle: Score or Submissions */}
                        <div className="text-center text-gray-800 text-sm">
                          {labelKey === "user"
                            ? entry.submission_count ?? 0
                            : Number(normalizedScore ?? 0).toFixed(2)}
                        </div>

                        {/* Right: Rank */}
                        <div className="flex flex-col items-center">
                          <span
                            className={`px-3 py-1 text-sm font-semibold rounded-full text-white ${bgClass}`}
                          >
                            {rank}
                          </span>
                          {isTie && (
                            <span className="text-xs text-gray-500 mt-1">
                              (tie)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {hasMore && (
                <div className="p-3 border-t bg-white">
                  <button
                    onClick={() => loadMore(loadMoreType)}
                    disabled={loadingMore[loadMoreType]}
                    className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:underline disabled:text-gray-400"
                  >
                    <span>{loadingMore[loadMoreType] ? 'Loading…' : 'Load more'}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Show loading spinner during initial loading
  if (isPageLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading leaderboards...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left: Filters */}
          <aside className="w-full md:w-72 border-r md:pr-4">
            <h2 className="text-lg font-semibold mb-4">Filters</h2>
            <div className="space-y-4">
              <button
                onClick={handleRefresh}
                disabled={!canRefresh}
                className={`text-sm ${canRefresh ? 'text-blue-600 hover:underline' : 'text-gray-400'} text-left`}
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
                <label className="block text-sm font-medium mb-2">Crop</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded border px-2 py-2"
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
                  className="text-sm text-blue-600 hover:underline text-left"
                >
                  Reset to My Location
                </button>
                <button
                  onClick={() => {
                    setLocation({ ...emptyLocation, country: "All countries" });
                    setCrop("");
                  }}
                  className="text-sm text-gray-600 hover:underline text-left"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </aside>

          {/* Right: Leaderboards */}
          <section className="flex-1">
            {dataScopeMessage && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                {dataScopeMessage}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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