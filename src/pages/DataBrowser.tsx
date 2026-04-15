import React from 'react';
import Header from '../components/Layout/Header';
import DataTable from '../components/DataBrowser/DataTable';
import { FilterProvider } from '../contexts/FilterContext';

const DataBrowser = () => {
  return (
    <FilterProvider>
      <div className="min-h-screen bg-cream">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
          <DataTable />
        </main>
      </div>
    </FilterProvider>
  );
};

export default DataBrowser;
