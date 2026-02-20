/**
 * Admin CRUD routes — full create/read/update/delete for reference data tables.
 * All routes require auth + admin role (enforced by the parent admin router in index.ts).
 *
 * Mounted at: /api/admin/crud
 *
 *   GET    /crops                 paginated list + search
 *   POST   /crops                 create
 *   PUT    /crops/:id             update
 *   DELETE /crops/:id             delete (blocked if submissions exist)
 *
 *   GET/POST/PUT/DELETE /brands
 *   GET/POST/PUT/DELETE /locations
 *   GET/POST/PUT/DELETE /categories       → crop_categories
 *   GET/POST/PUT/DELETE /location-types   → location_types
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../db/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth as any, requireAdmin as any);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function paginate(req: Request) {
  return {
    limit: Math.max(1, Math.min(Number(req.query.limit) || 50, 200)),
    offset: Math.max(0, Number(req.query.offset) || 0),
    search: (req.query.search as string | undefined)?.trim() || undefined,
  };
}

// ─── Crops ───────────────────────────────────────────────────────────────────

router.get('/crops', async (req: Request, res: Response) => {
  try {
    const { limit, offset, search } = paginate(req);
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { label: { contains: search, mode: 'insensitive' as const } }] }
      : undefined;
    const [data, total] = await Promise.all([
      prisma.crop.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
      prisma.crop.count({ where }),
    ]);
    res.json({ data: data.map(formatCrop), total });
  } catch (err) { console.error('[admin/crud/crops GET]', err); res.status(500).json({ error: 'Failed to fetch crops' }); }
});

router.post('/crops', async (req: Request, res: Response) => {
  try {
    const { name, label, category, poor_brix, average_brix, good_brix, excellent_brix } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const crop = await prisma.crop.create({
      data: {
        name: name.trim(),
        label: label?.trim() || null,
        category: category?.trim() || null,
        poorBrix: poor_brix != null ? Number(poor_brix) : null,
        averageBrix: average_brix != null ? Number(average_brix) : null,
        goodBrix: good_brix != null ? Number(good_brix) : null,
        excellentBrix: excellent_brix != null ? Number(excellent_brix) : null,
      },
    });
    res.status(201).json(formatCrop(crop));
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'A crop with that name already exists' }); return; }
    console.error('[admin/crud/crops POST]', err); res.status(500).json({ error: 'Failed to create crop' });
  }
});

router.put('/crops/:id', async (req: Request, res: Response) => {
  try {
    const { name, label, category, poor_brix, average_brix, good_brix, excellent_brix } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (label !== undefined) data.label = label?.trim() || null;
    if (category !== undefined) data.category = category?.trim() || null;
    if (poor_brix !== undefined) data.poorBrix = poor_brix != null ? Number(poor_brix) : null;
    if (average_brix !== undefined) data.averageBrix = average_brix != null ? Number(average_brix) : null;
    if (good_brix !== undefined) data.goodBrix = good_brix != null ? Number(good_brix) : null;
    if (excellent_brix !== undefined) data.excellentBrix = excellent_brix != null ? Number(excellent_brix) : null;
    const crop = await prisma.crop.update({ where: { id: req.params.id }, data });
    res.json(formatCrop(crop));
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Crop not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'A crop with that name already exists' }); return; }
    console.error('[admin/crud/crops PUT]', err); res.status(500).json({ error: 'Failed to update crop' });
  }
});

router.delete('/crops/:id', async (req: Request, res: Response) => {
  try {
    const count = await prisma.submission.count({ where: { cropId: req.params.id } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} submission(s) reference this crop` }); return; }
    await prisma.crop.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Crop not found' }); return; }
    console.error('[admin/crud/crops DELETE]', err); res.status(500).json({ error: 'Failed to delete crop' });
  }
});

function formatCrop(c: any) {
  return {
    id: c.id, name: c.name, label: c.label, category: c.category,
    poor_brix: c.poorBrix != null ? Number(c.poorBrix) : null,
    average_brix: c.averageBrix != null ? Number(c.averageBrix) : null,
    good_brix: c.goodBrix != null ? Number(c.goodBrix) : null,
    excellent_brix: c.excellentBrix != null ? Number(c.excellentBrix) : null,
  };
}

// ─── Brands ──────────────────────────────────────────────────────────────────

router.get('/brands', async (req: Request, res: Response) => {
  try {
    const { limit, offset, search } = paginate(req);
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { label: { contains: search, mode: 'insensitive' as const } }] }
      : undefined;
    const [data, total] = await Promise.all([
      prisma.brand.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
      prisma.brand.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { console.error('[admin/crud/brands GET]', err); res.status(500).json({ error: 'Failed to fetch brands' }); }
});

router.post('/brands', async (req: Request, res: Response) => {
  try {
    const { name, label } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const brand = await prisma.brand.create({ data: { name: name.trim(), label: label?.trim() || null } });
    res.status(201).json(brand);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'A brand with that name already exists' }); return; }
    console.error('[admin/crud/brands POST]', err); res.status(500).json({ error: 'Failed to create brand' });
  }
});

router.put('/brands/:id', async (req: Request, res: Response) => {
  try {
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.label !== undefined) data.label = req.body.label?.trim() || null;
    const brand = await prisma.brand.update({ where: { id: req.params.id }, data });
    res.json(brand);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Brand not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'A brand with that name already exists' }); return; }
    console.error('[admin/crud/brands PUT]', err); res.status(500).json({ error: 'Failed to update brand' });
  }
});

router.delete('/brands/:id', async (req: Request, res: Response) => {
  try {
    const count = await prisma.submission.count({ where: { brandId: req.params.id } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} submission(s) reference this brand` }); return; }
    await prisma.brand.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Brand not found' }); return; }
    console.error('[admin/crud/brands DELETE]', err); res.status(500).json({ error: 'Failed to delete brand' });
  }
});

// ─── Locations ────────────────────────────────────────────────────────────────

router.get('/locations', async (req: Request, res: Response) => {
  try {
    const { limit, offset, search } = paginate(req);
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { label: { contains: search, mode: 'insensitive' as const } }] }
      : undefined;
    const [data, total] = await Promise.all([
      prisma.location.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
      prisma.location.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { console.error('[admin/crud/locations GET]', err); res.status(500).json({ error: 'Failed to fetch locations' }); }
});

router.post('/locations', async (req: Request, res: Response) => {
  try {
    const { name, label, type } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const location = await prisma.location.create({ data: { name: name.trim(), label: label?.trim() || null, type: type?.trim() || null } });
    res.status(201).json(location);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'A location with that name already exists' }); return; }
    console.error('[admin/crud/locations POST]', err); res.status(500).json({ error: 'Failed to create location' });
  }
});

router.put('/locations/:id', async (req: Request, res: Response) => {
  try {
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.label !== undefined) data.label = req.body.label?.trim() || null;
    if (req.body.type !== undefined) data.type = req.body.type?.trim() || null;
    const location = await prisma.location.update({ where: { id: req.params.id }, data });
    res.json(location);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Location not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'A location with that name already exists' }); return; }
    console.error('[admin/crud/locations PUT]', err); res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/locations/:id', async (req: Request, res: Response) => {
  try {
    const count = await prisma.submission.count({ where: { locationId: req.params.id } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} submission(s) reference this location` }); return; }
    await prisma.location.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Location not found' }); return; }
    console.error('[admin/crud/locations DELETE]', err); res.status(500).json({ error: 'Failed to delete location' });
  }
});

// ─── Crop Categories ─────────────────────────────────────────────────────────

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { limit, offset, search } = paginate(req);
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { label: { contains: search, mode: 'insensitive' as const } }] } : undefined;
    const [data, total] = await Promise.all([
      prisma.cropCategory.findMany({ where, orderBy: { sortOrder: 'asc' }, take: limit, skip: offset }),
      prisma.cropCategory.count({ where }),
    ]);
    res.json({ data: data.map((c: any) => ({ id: c.id, name: c.name, label: c.label, sort_order: c.sortOrder })), total });
  } catch (err) { console.error('[admin/crud/categories GET]', err); res.status(500).json({ error: 'Failed to fetch categories' }); }
});

router.post('/categories', async (req: Request, res: Response) => {
  try {
    const { name, label, sort_order } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const cat = await prisma.cropCategory.create({ data: { name: name.trim(), label: label?.trim() || null, sortOrder: Number(sort_order) || 0 } });
    res.status(201).json({ id: cat.id, name: cat.name, label: cat.label, sort_order: cat.sortOrder });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'A category with that name already exists' }); return; }
    console.error('[admin/crud/categories POST]', err); res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
  try {
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.label !== undefined) data.label = req.body.label?.trim() || null;
    if (req.body.sort_order !== undefined) data.sortOrder = Number(req.body.sort_order) || 0;
    const cat = await prisma.cropCategory.update({ where: { id: req.params.id }, data });
    res.json({ id: cat.id, name: cat.name, label: cat.label, sort_order: cat.sortOrder });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Category not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'A category with that name already exists' }); return; }
    console.error('[admin/crud/categories PUT]', err); res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req: Request, res: Response) => {
  try {
    const cat = await prisma.cropCategory.findUnique({ where: { id: req.params.id } });
    if (!cat) { res.status(404).json({ error: 'Category not found' }); return; }
    const count = await prisma.crop.count({ where: { category: cat.name } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} crop(s) use this category` }); return; }
    await prisma.cropCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { console.error('[admin/crud/categories DELETE]', err); res.status(500).json({ error: 'Failed to delete category' }); }
});

// ─── Location Types ───────────────────────────────────────────────────────────

router.get('/location-types', async (req: Request, res: Response) => {
  try {
    const { limit, offset, search } = paginate(req);
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { label: { contains: search, mode: 'insensitive' as const } }] } : undefined;
    const [data, total] = await Promise.all([
      prisma.locationType.findMany({ where, orderBy: { sortOrder: 'asc' }, take: limit, skip: offset }),
      prisma.locationType.count({ where }),
    ]);
    res.json({ data: data.map((t: any) => ({ id: t.id, name: t.name, label: t.label, sort_order: t.sortOrder })), total });
  } catch (err) { console.error('[admin/crud/location-types GET]', err); res.status(500).json({ error: 'Failed to fetch location types' }); }
});

router.post('/location-types', async (req: Request, res: Response) => {
  try {
    const { name, label, sort_order } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const lt = await prisma.locationType.create({ data: { name: name.trim(), label: label?.trim() || null, sortOrder: Number(sort_order) || 0 } });
    res.status(201).json({ id: lt.id, name: lt.name, label: lt.label, sort_order: lt.sortOrder });
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'A location type with that name already exists' }); return; }
    console.error('[admin/crud/location-types POST]', err); res.status(500).json({ error: 'Failed to create location type' });
  }
});

router.put('/location-types/:id', async (req: Request, res: Response) => {
  try {
    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.label !== undefined) data.label = req.body.label?.trim() || null;
    if (req.body.sort_order !== undefined) data.sortOrder = Number(req.body.sort_order) || 0;
    const lt = await prisma.locationType.update({ where: { id: req.params.id }, data });
    res.json({ id: lt.id, name: lt.name, label: lt.label, sort_order: lt.sortOrder });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Location type not found' }); return; }
    if (err.code === 'P2002') { res.status(409).json({ error: 'A location type with that name already exists' }); return; }
    console.error('[admin/crud/location-types PUT]', err); res.status(500).json({ error: 'Failed to update location type' });
  }
});

router.delete('/location-types/:id', async (req: Request, res: Response) => {
  try {
    const lt = await prisma.locationType.findUnique({ where: { id: req.params.id } });
    if (!lt) { res.status(404).json({ error: 'Location type not found' }); return; }
    const count = await prisma.location.count({ where: { type: lt.name } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} location(s) use this type` }); return; }
    await prisma.locationType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { console.error('[admin/crud/location-types DELETE]', err); res.status(500).json({ error: 'Failed to delete location type' }); }
});

export default router;
