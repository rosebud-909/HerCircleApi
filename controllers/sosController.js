import {
  createSosRow,
  getSosById,
  getUserById,
  listActiveSos,
  nextId,
  patchSos,
} from '../store.js';
import { ok, err } from '../utils/http.js';

export async function createSos(req, res) {
  try {
    const { location, message, coordinates } = req.body ?? {};
    if (typeof location !== 'string' || !location.trim()) {
      return err(res, 'location is required', 400, 'validation_error');
    }
    if (message !== undefined && typeof message !== 'string') {
      return err(res, 'message must be a string', 400, 'validation_error');
    }
    if (
      coordinates !== undefined &&
      (typeof coordinates !== 'object' ||
        typeof coordinates.lat !== 'number' ||
        typeof coordinates.lng !== 'number')
    ) {
      return err(res, 'coordinates must be { lat: number, lng: number }', 400, 'validation_error');
    }
    const row = {
      id: nextId('sos'),
      userId: req.userId,
      location: location.trim(),
      message: message?.trim() ?? null,
      status: 'active',
      createdAt: new Date().toISOString(),
      coordinates: coordinates ?? null,
      notifiedCount: 24,
      policeNotified: true,
    };
    await createSosRow(row);
    return ok(res, row, 201);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function resolveSos(req, res) {
  try {
    const row = await getSosById(req.params.id);
    if (!row) return err(res, 'SOS not found', 404, 'not_found');
    if (row.userId !== req.userId) return err(res, 'Forbidden', 403, 'forbidden');
    const resolvedAt = new Date().toISOString();
    await patchSos(req.params.id, { status: 'resolved', resolvedAt });
    return ok(res, {
      id: row.id,
      status: 'resolved',
      resolvedAt,
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function patchMessage(req, res) {
  try {
    const row = await getSosById(req.params.id);
    if (!row) return err(res, 'SOS not found', 404, 'not_found');
    if (row.userId !== req.userId) return err(res, 'Forbidden', 403, 'forbidden');
    const { message } = req.body ?? {};
    if (typeof message !== 'string' || !message.trim()) {
      return err(res, 'message is required', 400, 'validation_error');
    }
    const trimmed = message.trim();
    await patchSos(req.params.id, { message: trimmed });
    return ok(res, { id: row.id, message: trimmed });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function listActive(req, res) {
  try {
    const active = await listActiveSos();
    const data = await Promise.all(
      active.map(async (s) => {
        const u = await getUserById(s.userId);
        return {
          id: s.id,
          userId: s.userId,
          location: s.location,
          message: s.message,
          status: s.status,
          createdAt: s.createdAt,
          user: u
            ? { name: u.name, verificationStatus: u.verificationStatus }
            : { name: 'Unknown', verificationStatus: 'unverified' },
        };
      }),
    );
    return ok(res, data);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
