import React from 'react';
import Header from '../components/Layout/Header';
import { PageBackground } from '../components/ui/PageBackground';
import DataTable from '../components/DataBrowser/DataTable';
import { FilterProvider } from '../contexts/FilterContext';

const DataBrowser = () => {
  return (
    <FilterProvider>
      <PageBackground className="min-h-screen">
        <Header />
        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 pb-[var(--bottom-inset)]">
          <DataTable />
        </main>
      </PageBackground>
    </FilterProvider>
  );
};

export default DataBrowser;
