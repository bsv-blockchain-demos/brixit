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
 *   GET/POST/PUT/DELETE /venues
 *   GET/POST/PUT/DELETE /categories       → crop_categories
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

// ─── Venues ──────────────────────────────────────────────────────────────────

router.get('/venues', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const where: any = search ? { name: { contains: search, mode: 'insensitive' } } : {};
    const [data, total] = await Promise.all([
      prisma.venue.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
      prisma.venue.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { console.error('[admin/crud/venues GET]', err); res.status(500).json({ error: 'Failed to fetch venues' }); }
});

router.post('/venues', async (req: Request, res: Response) => {
  try {
    const { name, posType, streetAddress, latitude, longitude, verified } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const venue = await prisma.venue.create({
      data: {
        name: name.trim(),
        posType: posType?.trim() || null,
        streetAddress: streetAddress?.trim() || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        verified: verified === true,
        createdByUserId: null,
      },
    });
    res.status(201).json(venue);
  } catch (err: any) {
    console.error('[admin/crud/venues POST]', err);
    res.status(500).json({ error: 'Failed to create venue' });
  }
});

router.put('/venues/:id', async (req: Request, res: Response) => {
  try {
    const { name, posType, streetAddress, latitude, longitude, verified } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (posType !== undefined) data.posType = posType?.trim() || null;
    if (streetAddress !== undefined) data.streetAddress = streetAddress?.trim() || null;
    if (latitude !== undefined) data.latitude = parseFloat(latitude);
    if (longitude !== undefined) data.longitude = parseFloat(longitude);
    if (verified !== undefined) data.verified = verified === true;
    const venue = await prisma.venue.update({ where: { id: req.params.id }, data });
    res.json(venue);
  } catch (err: any) {
    console.error('[admin/crud/venues PUT]', err);
    res.status(500).json({ error: 'Failed to update venue' });
  }
});

router.delete('/venues/:id', async (req: Request, res: Response) => {
  try {
    const count = await prisma.submission.count({ where: { venueId: req.params.id } });
    if (count > 0) { res.status(409).json({ error: `Cannot delete — ${count} submission(s) reference this venue` }); return; }
    await prisma.venue.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { console.error('[admin/crud/venues DELETE]', err); res.status(500).json({ error: 'Failed to delete venue' }); }
});

const COORD_TOLERANCE = 0.0001;

router.get('/venues/:id/nearby-unverified', async (req: Request, res: Response) => {
  try {
    const venue = await prisma.venue.findUnique({ where: { id: req.params.id } });
    if (!venue) { res.status(404).json({ error: 'Venue not found' }); return; }
    if (venue.latitude == null || venue.longitude == null) { res.json([]); return; }

    const nearby = await prisma.venue.findMany({
      where: {
        id: { not: req.params.id },
        verified: false,
        latitude: { gte: venue.latitude - COORD_TOLERANCE, lte: venue.latitude + COORD_TOLERANCE },
        longitude: { gte: venue.longitude - COORD_TOLERANCE, lte: venue.longitude + COORD_TOLERANCE },
      },
    });

    const counts = await prisma.submission.groupBy({
      by: ['venueId'],
      where: { venueId: { in: nearby.map(v => v.id) } },
      _count: { id: true },
    });
    const countMap = Object.fromEntries(counts.map(c => [c.venueId, c._count.id]));

    res.json(nearby.map(v => ({ ...v, submission_count: countMap[v.id] ?? 0 })));
  } catch (err) {
    console.error('[admin/crud/venues nearby-unverified]', err);
    res.status(500).json({ error: 'Failed to fetch nearby venues' });
  }
});

router.post('/venues/:id/verify', async (req: Request, res: Response) => {
  try {
    const mergeIds: string[] = Array.isArray(req.body.merge_venue_ids) ? req.body.merge_venue_ids : [];

    await prisma.$transaction(async (tx) => {
      if (mergeIds.length) {
        await tx.submission.updateMany({
          where: { venueId: { in: mergeIds } },
          data: { venueId: req.params.id },
        });
        // Only delete venues that are still unverified — guards against bad IDs
        await tx.venue.deleteMany({
          where: { id: { in: mergeIds }, verified: false },
        });
      }
      await tx.venue.update({ where: { id: req.params.id }, data: { verified: true } });
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[admin/crud/venues verify]', err);
    res.status(500).json({ error: 'Failed to verify venue' });
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

export default router;
