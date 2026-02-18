import React, { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Beaker, CheckCircle, MapPin, Trash2, Loader2, AlertCircle, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { deleteSubmission } from '../lib/fetchSubmissions';
import { useMySubmissionsQuery } from '../hooks/useSubmissions';

import SubmissionTableRow from '../components/common/SubmissionTableRow';
import { BrixDataPoint } from '../types';
import { useToast } from '../hooks/use-toast';
import DataPointDetailModal from '../components/common/DataPointDetailModal';
import { useStaticData } from '../hooks/useStaticData'; // New Import
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

  const canSubmit = user?.role === 'admin' || user?.role === 'contributor';
  const [isSubmitInfoOpen, setIsSubmitInfoOpen] = useState(false);

  // Use the useStaticData hook to handle loading state
  const { isLoading: isLoadingStaticData } = useStaticData();

  const submissionsQuery = useMySubmissionsQuery(user?.id);

  const [userSubmissions, setUserSubmissions] = useState<BrixDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // New state for the modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState<BrixDataPoint | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setUserSubmissions([]);
      setLoading(false);
      return;
    }

    if (submissionsQuery.isLoading) {
      setLoading(true);
      return;
    }

    if (submissionsQuery.error) {
      setLoading(false);
      setUserSubmissions([]);
      toast({ title: 'Error loading your data', description: 'Please try again later.', variant: 'destructive' });
      return;
    }

    const submissions = submissionsQuery.data || [];
    setUserSubmissions(submissions);
    setLoading(false);
  }, [user?.id, submissionsQuery.data, submissionsQuery.isLoading, submissionsQuery.error, toast]);

  const handleAttemptSubmit = () => {
    setIsSubmitInfoOpen(true);
  };

  // Handler to open the modal with a specific data point
  const handleOpenModal = (dataPoint: BrixDataPoint) => {
    setSelectedDataPoint(dataPoint);
    setIsModalOpen(true);
  };

  // Handler to close the modal
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
        // Update local state after successful deletion
        setUserSubmissions(prev => prev.filter(sub => sub.id !== id));
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
  if (loading || isLoadingStaticData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-gray-600">Loading your submissions...</p>
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
                <CardTitle>Submitted Measurements ({userSubmissions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {userSubmissions.length === 0 ? (
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
                        {userSubmissions.map((submission) => {
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
                      <p className="text-2xl font-bold">{userSubmissions.length}</p>
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
                        {userSubmissions.filter(s => s.verified).length}
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
                        {new Set(userSubmissions.map(s => s.cropType)).size}
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