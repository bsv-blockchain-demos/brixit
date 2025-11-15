import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdminUserManagement from '@/components/Admin/AdminUserManagement';
import AdminSubmissionQueue from '@/components/Admin/AdminSubmissionQueue';

export default function Admin() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
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
