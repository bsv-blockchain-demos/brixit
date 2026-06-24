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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, RefreshCw, Info } from 'lucide-react';
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
  /** When true, the value is constrained to a DB slug: lowercase, no spaces, [a-z0-9_] only. */
  slug?: boolean;
  /** Optional guidance shown in a tooltip beside the field label. */
  help?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  title: string;
  /** Section heading shown above the toolbar. Defaults to `title`. */
  heading?: string;
  /** Small subtext under the heading. */
  description?: string;
  singular?: string;
  queryKey: string;
  columns: ColumnDef[];
  formFields: FieldDef[];
  fetchFn: (p: { search?: string; limit: number; offset: number }) => Promise<PaginatedResult<any>>;
  createFn: (data: Record<string, any>) => Promise<any>;
  updateFn: (id: string, data: Record<string, any>) => Promise<any>;
  deleteFn: (id: string) => Promise<any>;
  extraRowActions?: (row: any, invalidate: () => void) => React.ReactNode;
  /** Optional mobile (<sm) card renderer. When set, the table is desktop-only and rows render as cards on mobile. */
  renderMobileCard?: (row: any, actions: { onEdit: () => void; onDelete: () => void }) => React.ReactNode;
}

// Component

const PAGE_SIZE_OPTIONS = [20, 100, 200];
const emptyForm = (fields: FieldDef[]) => Object.fromEntries(fields.map(f => [f.key, '']));

// Constrain free text to a DB slug: lowercase, spaces/hyphens → underscore, strip the rest.
const sanitizeSlug = (s: string) =>
  s.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
const SLUG_RE = /^[a-z0-9_]+$/;

export default function AdminTableEditor({
  title,
  heading,
  description,
  singular,
  queryKey,
  columns,
  formFields,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  extraRowActions,
  renderMobileCard,
}: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Search / pagination
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

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
    queryKey: [queryKey, committedSearch, page, pageSize],
    queryFn: () =>
      fetchFn({ search: committedSearch || undefined, limit: pageSize, offset: page * pageSize }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

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
      const val = String(formValues[f.key] ?? '').trim();
      if (f.required && !val) {
        toast({ title: `"${f.label}" is required`, variant: 'destructive' });
        return;
      }
      if (f.slug && val && !SLUG_RE.test(val)) {
        toast({ title: `"${f.label}" must be lowercase letters, numbers or underscores, no spaces`, variant: 'destructive' });
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

  const singularTitle = singular ?? (title.endsWith('ies') ? title.slice(0, -3) + 'y' : title.endsWith('s') ? title.slice(0, -1) : title);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <h2 className="text-xl font-display font-bold text-text-dark">{heading ?? title}</h2>
        {description && <p className="text-sm text-text-mid">{description}</p>}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
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
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: [queryKey] })}
          disabled={isFetching}
          aria-label="Refresh"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1 min-h-[40px] px-4 rounded-lg bg-action-primary hover:bg-action-primary-hover text-white text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Add {singularTitle}
        </button>
        <Select
          value={String(pageSize)}
          onValueChange={val => { setPageSize(Number(val)); setPage(0); }}
        >
          <SelectTrigger className="ml-auto h-10 w-[110px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)}>Show {n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table — one surface, hairline rows, canvas header. Desktop table + optional mobile cards. */}
      <div className="rounded-2xl border border-hairline bg-card shadow-sm overflow-hidden">
        <div className={`overflow-x-auto ${renderMobileCard ? 'hidden sm:block' : ''}`}>
          <Table>
            <TableHeader>
              <TableRow className="bg-table-header hover:bg-table-header border-hairline">
                {columns.map(col => (
                  <TableHead key={col.key} className="text-xs font-medium uppercase tracking-wider text-text-muted-brown">{col.label}</TableHead>
                ))}
                <TableHead className="w-20 text-right text-xs font-medium uppercase tracking-wider text-text-muted-brown">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center text-text-mid py-10">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="text-center text-text-mid py-10">
                    {committedSearch ? `No results for "${committedSearch}"` : 'No records yet'}
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((row: any) => (
                  <TableRow key={row.id} className={`border-hairline hover:bg-surface-canvas ${isFetching ? 'opacity-60' : ''}`}>
                    {columns.map(col => (
                      <TableCell key={col.key} className="text-text-dark">
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key] != null
                            ? String(row[col.key])
                            : <span className="text-text-muted text-xs">-</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {extraRowActions?.(row, () => queryClient.invalidateQueries({ queryKey: [queryKey] }))}
                        <button
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-mid hover:bg-surface-canvas"
                          onClick={() => openEdit(row)}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteTarget(row); setDeleteError(''); }}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards (<sm) */}
        {renderMobileCard && (
          <div className="sm:hidden divide-y divide-hairline">
            {isLoading ? (
              <p className="text-center text-text-mid py-10 text-sm">Loading...</p>
            ) : data?.data.length === 0 ? (
              <p className="text-center text-text-mid py-10 text-sm">
                {committedSearch ? `No results for "${committedSearch}"` : 'No records yet'}
              </p>
            ) : (
              data?.data.map((row: any) => (
                <div key={row.id} className={isFetching ? 'opacity-60' : ''}>
                  {renderMobileCard(row, {
                    onEdit: () => openEdit(row),
                    onDelete: () => { setDeleteTarget(row); setDeleteError(''); },
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Total count + pagination (page indicator centered, matching the user data panel) */}
      <div className="space-y-3">
        <p className="text-sm text-text-mid">
          {data?.total ?? 0} total
          {committedSearch && ` for "${committedSearch}"`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="border-hairline hover:bg-surface-canvas gap-1"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="border-hairline hover:bg-surface-canvas gap-1"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
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
                <Label htmlFor={field.key} className="flex items-center gap-1.5">
                  {field.label}
                  {field.required && <span className="text-destructive">*</span>}
                  {field.help && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`About ${field.label}`}
                          className="text-text-muted hover:text-text-mid"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{field.help}</TooltipContent>
                    </Tooltip>
                  )}
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
                        <span className="text-muted-foreground">None</span>
                      </SelectItem>
                      {field.options?.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      id={field.key}
                      type={field.type}
                      step={field.step}
                      value={formValues[field.key] ?? ''}
                      onChange={e =>
                        setFormValues(v => ({
                          ...v,
                          [field.key]: field.slug ? sanitizeSlug(e.target.value) : e.target.value,
                        }))
                      }
                      placeholder={field.placeholder ?? field.label}
                      {...(field.slug
                        ? { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false }
                        : {})}
                    />
                    {field.slug && (
                      <p className="text-xs text-text-muted-brown">
                        Lowercase letters, numbers and underscores only, no spaces.
                      </p>
                    )}
                  </>
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
