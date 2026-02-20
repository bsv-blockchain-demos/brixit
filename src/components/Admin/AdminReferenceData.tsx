import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminTableEditor from './AdminTableEditor';
import type { ColumnDef, FieldDef } from './AdminTableEditor';
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  fetchAdminLocationTypes,
  createAdminLocationType,
  updateAdminLocationType,
  deleteAdminLocationType,
} from '@/lib/adminApi';

const CATEGORY_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
  { key: 'sort_order', label: 'Sort Order' },
];

const CATEGORY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. fruit' },
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Fruit' },
  { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
];

const LOC_TYPE_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'label', label: 'Label' },
  { key: 'sort_order', label: 'Sort Order' },
];

const LOC_TYPE_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Grocery' },
  { key: 'label', label: 'Display Label', type: 'text', placeholder: 'e.g. Grocery Store' },
  { key: 'sort_order', label: 'Sort Order', type: 'number', placeholder: '0' },
];

export default function AdminReferenceData() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Reference Data</h2>
        <p className="text-sm text-muted-foreground">
          Manage crop categories and location types used across the app
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Crop Categories</TabsTrigger>
          <TabsTrigger value="location-types">Location Types</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <AdminTableEditor
            title="Categories"
            queryKey="admin-categories"
            columns={CATEGORY_COLUMNS}
            formFields={CATEGORY_FIELDS}
            fetchFn={fetchAdminCategories}
            createFn={createAdminCategory}
            updateFn={updateAdminCategory}
            deleteFn={deleteAdminCategory}
          />
        </TabsContent>

        <TabsContent value="location-types" className="mt-4">
          <AdminTableEditor
            title="Location Types"
            queryKey="admin-location-types"
            columns={LOC_TYPE_COLUMNS}
            formFields={LOC_TYPE_FIELDS}
            fetchFn={fetchAdminLocationTypes}
            createFn={createAdminLocationType}
            updateFn={updateAdminLocationType}
            deleteFn={deleteAdminLocationType}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
