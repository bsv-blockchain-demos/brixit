import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MapFilter } from '../types';
import { useAuth } from './AuthContext';

// Define default filter values for consistency
export const DEFAULT_MAP_FILTERS: MapFilter = {
  cropTypes: [],
  brixRange: [0, 30],
  dateRange: ['', ''],
  verifiedOnly: true,
  timestamped: false,
  submittedBy: '',
  place: '',
  brand: '',
  hasImage: false,
  category: '',
  location: '',
  city: '',
  state: '',
  country: '',
  search: '',
};

/** Whose readings the browser is showing. Lives here, not in the results
 *  component, because the toolbar that toggles it sits in a sibling. */
export type SubmissionScope = 'all' | 'mine';

interface FilterContextType {
  filters: MapFilter;
  scope: SubmissionScope;
  setScope: (scope: SubmissionScope) => void;
  setFilters: React.Dispatch<React.SetStateAction<MapFilter>>;
  isAdmin: boolean;
  totalSubmissions: number;
  filteredCount: number;
  setFilteredCount: (count: number) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const { isAdmin } = useAuth();
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  // Initialize filters with the default values
  const [filters, setFilters] = useState<MapFilter>(DEFAULT_MAP_FILTERS);

  // Seeded from the URL so /my-data can redirect straight into "mine", and so
  // a shared link keeps the scope.
  const [scope, setScope] = useState<SubmissionScope>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('scope') === 'mine'
      ? 'mine'
      : 'all',
  );

  // For non-admin users, always enforce verifiedOnly = true
  const updateFilters: React.Dispatch<React.SetStateAction<MapFilter>> = (action) => {
    setFilters(prevFilters => {
      const newFilters = typeof action === 'function' ? action(prevFilters) : action;
      if (!isAdmin) {
        return { ...newFilters, verifiedOnly: true };
      }
      return newFilters;
    });
  };

  const value: FilterContextType = {
    filters,
    scope,
    setScope,
    setFilters: updateFilters,
    isAdmin,
    totalSubmissions,
    filteredCount,
    setFilteredCount,
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};
