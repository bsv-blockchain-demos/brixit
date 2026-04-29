import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminUserManagement from '@/components/Admin/AdminUserManagement';
import AdminSubmissionQueue from '@/components/Admin/AdminSubmissionQueue';
import AdminOverview from '@/components/Admin/AdminOverview';
import AdminCrops from '@/components/Admin/AdminCrops';
import AdminBrands from '@/components/Admin/AdminBrands';
import AdminVenues from '@/components/Admin/AdminVenues';
import AdminReferenceData from '@/components/Admin/AdminReferenceData';
import Header from '@/components/Layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto p-6 pb-20">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap gap-1 h-auto mb-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="crops">Crops</TabsTrigger>
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="venues">Venues</TabsTrigger>
            <TabsTrigger value="reference">Reference Data</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <AdminOverview />
          </TabsContent>

          <TabsContent value="submissions" className="mt-6">
            <AdminSubmissionQueue />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="crops" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Crops</h2>
              <p className="text-sm text-muted-foreground">
                Manage crops and their Brix quality thresholds
              </p>
            </div>
            <AdminCrops />
          </TabsContent>

          <TabsContent value="brands" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Brands</h2>
              <p className="text-sm text-muted-foreground">
                Manage store and brand names
              </p>
            </div>
            <AdminBrands />
          </TabsContent>

          <TabsContent value="venues" className="mt-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Venues</h2>
              <p className="text-sm text-muted-foreground">
                Manage community-submitted and system-created venues
              </p>
            </div>
            <AdminVenues />
          </TabsContent>

          <TabsContent value="reference" className="mt-6">
            <AdminReferenceData />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
