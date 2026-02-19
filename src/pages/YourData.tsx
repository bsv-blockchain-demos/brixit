import React, { useEffect, useMemo, useState } from 'react';
import Header from '../components/Layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Beaker, CheckCircle, MapPin, AlertCircle, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteSubmission } from '../lib/fetchSubmissions';
import { fetchMySubmissionsPage } from '../lib/fetchSubmissions';
import { useMySubmissionsCountQuery, useMySubmissionsCropIdsQuery, useMySubmissionsPageQuery } from '../hooks/useSubmissions';

import SubmissionTableRow from '../components/common/SubmissionTableRow';
import { BrixDataPoint } from '../types';
import { useToast } from '../hooks/use-toast';
import DataPointDetailModal from '../components/common/DataPointDetailModal';
import { useStaticData } from '../hooks/useStaticData';
import { useQueryClient } from '@tanstack/react-query';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

const YourData: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canSubmit = user?.role === 'admin' || user?.role === 'contributor';
  const [isSubmitInfoOpen, setIsSubmitInfoOpen] = useState(false);

  // Use the useStaticData hook to handle loading state
  const { isLoading: isLoadingStaticData } = useStaticData();

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const chunkSize = 50;

  // Calculate which chunk we're on and set offset for db query
  const chunkIndex = Math.floor(((currentPage - 1) * itemsPerPage) / chunkSize);
  const chunkOffset = chunkIndex * chunkSize;
  const inChunkStart = ((currentPage - 1) * itemsPerPage) - chunkOffset;

  const submissionsCountQuery = useMySubmissionsCountQuery(
    user?.id ? { userId: user.id } : undefined
  );
  const verifiedCountQuery = useMySubmissionsCountQuery(
    user?.id ? { userId: user.id, verified: true } : undefined
  );

  const submissionsPageQuery = useMySubmissionsPageQuery(
    user?.id
      ? {
          userId: user.id,
          limit: chunkSize,
          offset: chunkOffset,
          sortBy: 'assessment_date',
          sortOrder: 'desc',
        }
      : undefined
  );

  const cropIdsQuery = useMySubmissionsCropIdsQuery(user?.id);

  const userSubmissions = submissionsPageQuery.data || [];
  const totalCount = submissionsCountQuery.data ?? 0;
  const verifiedCount = verifiedCountQuery.data ?? 0;
  const uniqueCropTypesCount = useMemo(() => {
    const ids = cropIdsQuery.data || [];
    return new Set(ids).size;
  }, [cropIdsQuery.data]);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Determine if we should prefetch the next chunk
  const shouldPrefetchNextChunk =
    // Is there any data?
    totalCount > 0 &&
    // Are we at the end of a chunk?
    (currentPage * itemsPerPage) % chunkSize === 0 &&
    // Is there more data to fetch?
    chunkOffset + chunkSize < totalCount;

  const nextPageQuery = useMemo(() => {
    return user?.id
      ? {
          userId: user.id,
          limit: chunkSize,
          offset: chunkOffset + chunkSize,
          sortBy: 'assessment_date' as const,
          sortOrder: 'desc' as const,
        }
      : undefined;
  }, [chunkOffset, user?.id]);

  useEffect(() => {
    if (!shouldPrefetchNextChunk || !nextPageQuery) return;

    queryClient.prefetchQuery({
      queryKey: ['submissions', 'mine', 'page', nextPageQuery],
      queryFn: () => fetchMySubmissionsPage(nextPageQuery),
      staleTime: 60 * 60 * 1000,
    });
  }, [nextPageQuery, queryClient, shouldPrefetchNextChunk]);

  const currentItems = useMemo(() => {
    const endIndex = inChunkStart + itemsPerPage;
    return userSubmissions.slice(inChunkStart, endIndex);
  }, [userSubmissions, inChunkStart]);

  // New state for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<BrixDataPoint | null>(null);

  const isLoading =
    submissionsPageQuery.isLoading ||
    submissionsCountQuery.isLoading ||
    verifiedCountQuery.isLoading ||
    cropIdsQuery.isLoading;

  const isError =
    submissionsPageQuery.error ||
    submissionsCountQuery.error ||
    verifiedCountQuery.error ||
    cropIdsQuery.error;

  const handleAttemptSubmit = () => {
    setIsSubmitInfoOpen(true);
  };

  const handleOpenModal = (dataPoint: BrixDataPoint) => {
    setSelectedDataPoint(dataPoint);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDataPoint(null);
  };

  // Handler for deletion, now that it's in the modal
  const handleDelete = async (id: string) => {
    try {
      const success = await deleteSubmission(id);
      if (success) {
        toast({ title: 'Submission deleted successfully!', variant: 'default' });
        queryClient.invalidateQueries({ queryKey: ['submissions', 'mine'] });
        handleCloseModal(); // Close the modal
      } else {
        toast({ title: 'Failed to delete submission.', description: 'Please try again.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error during deletion process:', error);
      toast({ title: 'An error occurred.', description: 'Could not delete submission.', variant: 'destructive' });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="text-center py-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Please Log In</h2>
              <p className="text-gray-600 mb-6">
                You need to be logged in to view your data submissions.
              </p>
              <Link to="/login">
                <Button>Log In</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Combined loading state check
  if (isLoading || isLoadingStaticData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-gray-600">Loading your submissions...</p>
        </main>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-red-600">Error: Failed to load your submissions.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Data
            </h1>
            <p className="text-gray-600">
              Manage and track your BRIX measurement submissions
            </p>
          </div>

          {canSubmit ? (
            <Link to="/data-entry">
              <Button className="flex items-center space-x-2 bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4" />
                <span>Add New Measurement</span>
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              className="flex items-center space-x-2"
              onClick={handleAttemptSubmit}
            >
              <Lock className="w-4 h-4" />
              <span>Submissions Disabled</span>
            </Button>
          )}
        </div>

        <Tabs defaultValue="submissions" className="space-y-6">
          <TabsList>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle>Submitted Measurements ({totalCount})</CardTitle>
              </CardHeader>
              <CardContent>
                {totalCount === 0 ? (
                  <div className="text-center py-12">
                    {canSubmit ? (
                      <>
                        <Beaker className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No submissions yet</h3>
                        <p className="text-gray-600 mb-6">
                          Start contributing by submitting your first BRIX measurement!
                        </p>
                        <Link to="/data-entry">
                          <Button className="bg-green-600 hover:bg-green-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Submit First Measurement
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Submissions are disabled</h3>
                        <p className="text-gray-600 mb-6">
                          Your account currently has observer access, so you can browse data but can’t submit measurements yet.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                          <Button variant="outline" onClick={handleAttemptSubmit}>
                            Learn more
                          </Button>
                          <Button onClick={() => navigate('/leaderboard')}>
                            Go to Leaderboard
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table style={{ tableLayout: 'fixed', minWidth: '100%' }}>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[28%]">Crop / Details</TableHead>
                          <TableHead className="w-[10%] text-center">BRIX</TableHead>
                          <TableHead className="w-[20%]">Location / Notes</TableHead>
                          <TableHead className="w-[17%]">Assessment Date</TableHead>
                          <TableHead className="w-[15%] text-center">Verified?</TableHead>
                          <TableHead className="w-[10%] text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentItems.map((submission) => {
                          const isOwner = user?.id === submission.userId;
                          const canDeleteByOwner = (isOwner && !submission.verified);
                          return (
                            <SubmissionTableRow
                              key={submission.id}
                              submission={submission}
                              onDelete={() => handleDelete(submission.id)} // Pass handler for direct delete
                              onOpenModal={() => handleOpenModal(submission)} // Pass new open modal handler
                              isOwner={isOwner}
                              canDeleteByOwner={canDeleteByOwner}
                            />
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="mt-6 flex items-center justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Beaker className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{totalCount}</p>
                      <p className="text-sm text-gray-600">Total Submissions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {verifiedCount}
                      </p>
                      <p className="text-sm text-gray-600">Verified Measurements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        {uniqueCropTypesCount}
                      </p>
                      <p className="text-sm text-gray-600">Unique Crop Types</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* The Modal Component - now handling delete functionality */}
        <DataPointDetailModal
          dataPoint={selectedDataPoint}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onDeleteSuccess={(id) => {
            handleDelete(id);
          }}
        />

        <AlertDialog open={isSubmitInfoOpen} onOpenChange={setIsSubmitInfoOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submissions are disabled for your account</AlertDialogTitle>
              <AlertDialogDescription>
                Your current role is observer, so you can view and manage existing entries but you can’t submit new measurements yet.
                Ask an admin to upgrade your role to contributor.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setIsSubmitInfoOpen(false);
                  navigate('/leaderboard');
                }}
              >
                Go to Leaderboard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default YourData;