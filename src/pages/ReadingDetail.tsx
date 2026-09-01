// src/pages/ReadingDetail.tsx
import React, { useCallback } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import Header from '../components/Layout/Header';
import { PageBackground } from '../components/ui/PageBackground';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import DataPointDetailModal from '../components/common/DataPointDetailModal';
import { useFormattedSubmissionByIdQuery } from '../hooks/useSubmissions';
import { describeApiError } from '../lib/describeApiError';
import { titleCase } from '../lib/titleCase';

/**
 * A reading as its own page, reached from the readings browser on desktop.
 *
 * The same detail used to be a dialog everywhere. A dialog has no address, so
 * a reading could not be linked to or opened in a new tab, and the browser's
 * back button closed the whole page rather than the overlay. On a narrow
 * screen the overlay still wins, so the list stays put behind it; the browser
 * navigates here instead.
 */
const ReadingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Preserve the scope the user came from, so Back lands on the same list.
  const backTo = searchParams.get('scope') === 'mine' ? '/data?scope=mine' : '/data';

  const { data: reading, isLoading, error } = useFormattedSubmissionByIdQuery(id);

  const handleClose = useCallback(() => navigate(backTo), [navigate, backTo]);

  const handleDeleteSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
    navigate(backTo);
  }, [queryClient, navigate, backTo]);

  const handleUpdateSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['submissions'] });
  }, [queryClient]);

  const crumbLabel = reading
    ? titleCase(reading.cropLabel ?? reading.cropType) || 'Reading'
    : 'Reading';

  return (
    <PageBackground className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-[var(--bottom-inset)]">
        <Breadcrumb className="mb-4">
          <BreadcrumbList className="text-on-bg-body">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={backTo} className="hover:text-on-bg-text">Readings</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-on-bg-text">{crumbLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-on-bg-body">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading reading...
          </div>
        ) : error || !reading ? (
          <div className="rounded-2xl border border-hairline bg-card p-6">
            <p className="font-medium text-text-dark">
              {error ? describeApiError(error).title : 'Reading not found'}
            </p>
            <p className="mt-1 text-sm text-text-mid">
              {error
                ? describeApiError(error).detail
                : 'It may have been deleted, or the link may be wrong.'}
            </p>
            <Link to={backTo} className="mt-3 inline-block text-sm font-medium text-action-primary hover:underline">
              Back to readings
            </Link>
          </div>
        ) : (
          <DataPointDetailModal
            presentation="page"
            dataPoint={reading}
            isOpen
            onClose={handleClose}
            onDeleteSuccess={handleDeleteSuccess}
            onUpdateSuccess={handleUpdateSuccess}
          />
        )}
      </main>
    </PageBackground>
  );
};

export default ReadingDetail;
