import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminUserManagement from '@/components/Admin/AdminUserManagement';
import AdminSubmissionQueue from '@/components/Admin/AdminSubmissionQueue';
import AdminOverview from '@/components/Admin/AdminOverview';
import AdminCrops from '@/components/Admin/AdminCrops';
import AdminBrands from '@/components/Admin/AdminBrands';
import AdminVenues from '@/components/Admin/AdminVenues';
import AdminReferenceData from '@/components/Admin/AdminReferenceData';
import AdminTreasury from '@/components/Admin/AdminTreasury';
import Header from '@/components/Layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'submissions', label: 'Submissions' },
  { value: 'users', label: 'Users' },
  { value: 'crops', label: 'Crops' },
  { value: 'brands', label: 'Brands' },
  { value: 'venues', label: 'Venues' },
  { value: 'reference', label: 'Reference Data' },
  { value: 'treasury', label: 'Treasury' },
];

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      <Header />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Steel header band: title + tab strip */}
        <div className="bg-background">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="h-8 w-8 text-white hover:bg-white/10"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-display font-bold text-white">Admin Dashboard</h1>
            </div>

            {/* Tabs: desktop = cut-out strip connecting to the canvas; mobile = scrolling pills */}
            <TabsList className="flex w-full justify-start gap-1 h-auto p-0 bg-transparent rounded-none overflow-x-auto sm:overflow-visible scrollbar-none">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg sm:rounded-b-none border border-transparent
                    text-white/80 hover:bg-white/10
                    data-[state=active]:shadow-none
                    data-[state=active]:bg-select-bg data-[state=active]:text-select-fg data-[state=active]:border-select-border
                    sm:data-[state=active]:bg-surface-canvas sm:data-[state=active]:text-blue-deep sm:data-[state=active]:border-transparent"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        {/* Body on the calm canvas */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-20">
          <TabsContent value="overview" className="mt-0">
            <AdminOverview onReviewPending={() => setActiveTab('submissions')} />
          </TabsContent>

          <TabsContent value="submissions" className="mt-0">
            <AdminSubmissionQueue />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="crops" className="mt-0">
            <AdminCrops />
          </TabsContent>

          <TabsContent value="brands" className="mt-0">
            <AdminBrands />
          </TabsContent>

          <TabsContent value="venues" className="mt-0">
            <AdminVenues />
          </TabsContent>

          <TabsContent value="reference" className="mt-0">
            <AdminReferenceData />
          </TabsContent>

          <TabsContent value="treasury" className="mt-0">
            <AdminTreasury />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
