import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import AdminUserManagement from '@/components/Admin/AdminUserManagement';
import AdminSubmissionQueue from '@/components/Admin/AdminSubmissionQueue';

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><AdminUserManagement /></TabsContent>
        <TabsContent value="submissions"><AdminSubmissionQueue /></TabsContent>
      </Tabs>
    </div>
  );
}
