/**
 * Generic admin CRUD table with search, pagination, and a dialog-based form.
 * Each resource (Crops, Brands, etc.) wraps this with its own column/field config.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PaginatedResult } from '@/lib/adminApi';

// Types

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  step?: string;
  placeholder?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  title: string;
  queryKey: string;
  columns: ColumnDef[];
  formFields: FieldDef[];
  fetchFn: (p: { search?: string; limit: number; offset: number }) => Promise<PaginatedResult<any>>;
  createFn: (data: Record<string, any>) => Promise<any>;
  updateFn: (id: string, data: Record<string, any>) => Promise<any>;
  deleteFn: (id: string) => Promise<any>;
  extraRowActions?: (row: any, invalidate: () => void) => React.ReactNode;
}

// Component

const PAGE_SIZE = 25;
const emptyForm = (fields: FieldDef[]) => Object.fromEntries(fields.map(f => [f.key, '']));

export default function AdminTableEditor({
  title,
  queryKey,
  columns,
  formFields,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  extraRowActions,
}: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Search / pagination
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(0);

  // Create / edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [queryKey, committedSearch, page],
    queryFn: () =>
      fetchFn({ search: committedSearch || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const openCreate = () => {
    setFormValues(emptyForm(formFields));
    setEditRow(null);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setFormValues(Object.fromEntries(formFields.map(f => [f.key, row[f.key] ?? ''])));
    setEditRow(row);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    for (const f of formFields) {
      if (f.required && !String(formValues[f.key] ?? '').trim()) {
        toast({ title: `"${f.label}" is required`, variant: 'destructive' });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        formFields.map(f => [f.key, formValues[f.key] === '' ? null : formValues[f.key]])
      );
      if (editRow) {
        await updateFn(editRow.id, payload);
        toast({ title: 'Updated successfully' });
      } else {
        await createFn(payload);
        toast({ title: 'Created successfully' });
      }
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFn(deleteTarget.id);
      toast({ title: 'Deleted' });
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setDeleteTarget(null);
      setDeleteError('');
    } catch (err: any) {
      setDeleteError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const singularTitle = title.endsWith('s') ? title.slice(0, -1) : title;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search... (press Enter)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setPage(0);
                setCommittedSearch(search);
              }
            }}
            className="pl-9"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: [queryKey] })}
          disabled={isFetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add {singularTitle}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center text-muted-foreground py-10"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center text-muted-foreground py-10"
                >
                  {committedSearch ? `No results for "${committedSearch}"` : 'No records yet'}
                </TableCell>
              </TableRow>
            ) : (
              data?.data.map((row: any) => (
                <TableRow key={row.id} className={isFetching ? 'opacity-60' : ''}>
                  {columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] != null
                          ? String(row[col.key])
                          : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {extraRowActions?.(row, () => queryClient.invalidateQueries({ queryKey: [queryKey] }))}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(row)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { setDeleteTarget(row); setDeleteError(''); }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination / total */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data?.total ?? 0} total
          {committedSearch && ` for "${committedSearch}"`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page + 1} of {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRow ? 'Edit' : 'Add'} {singularTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formFields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {field.type === 'checkbox' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id={field.key}
                      type="checkbox"
                      checked={!!formValues[field.key]}
                      onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-input accent-green-fresh cursor-pointer"
                    />
                    <label htmlFor={field.key} className="text-sm text-muted-foreground cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                ) : field.type === 'select' ? (
                  <Select
                    value={String(formValues[field.key] ?? '')}
                    onValueChange={val =>
                      setFormValues(v => ({ ...v, [field.key]: val === '__none__' ? '' : val }))
                    }
                  >
                    <SelectTrigger id={field.key}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">— None —</span>
                      </SelectItem>
                      {field.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    step={field.step}
                    value={formValues[field.key] ?? ''}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    placeholder={field.placeholder ?? field.label}
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editRow ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteError(''); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive px-6 -mt-2">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
