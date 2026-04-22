import {
  createRequestRow,
  getRequestById,
  listRequestsFeed,
  nextId,
  updateRequestStatus,
} from '../store.js';
import { ok, err } from '../utils/http.js';
import { requestWithUser } from '../utils/presenters.js';

export async function listFeed(req, res) {
  try {
    const { category, status = 'open', sortBy = 'urgency', page = '1', limit = '20' } = req.query;
    const categories = ['menstrual', 'food', 'hygiene', 'kids', 'transport', 'errands', 'other'];
    const requestTypes = ['housing', 'health', 'emotional'];
    const requestType = req.query.requestType;
    const requestTypeFilter =
      requestType && requestTypes.includes(String(requestType)) ? String(requestType) : undefined;

    const categoryFilter =
      category && categories.includes(String(category)) ? String(category) : undefined;
    const statusStr = String(status);
    const statusFilter = ['open', 'fulfilled'].includes(statusStr) ? statusStr : 'open';
    const sortByStr = String(sortBy);
    const sortByFilter = sortByStr === 'createdAt' ? 'createdAt' : 'urgency';

    const list = await listRequestsFeed({
      category: categoryFilter,
      requestType: requestTypeFilter,
      status: statusFilter,
      sortBy: sortByFilter,
    });

    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const total = list.length;
    const slice = list.slice((p - 1) * lim, p * lim);
    const requests = await Promise.all(slice.map((r) => requestWithUser(r)));
    return ok(res, {
      requests,
      pagination: { page: p, limit: lim, total },
    });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function getById(req, res) {
  try {
    const r = await getRequestById(req.params.id);
    if (!r) return err(res, 'Request not found', 404, 'not_found');
    return ok(res, await requestWithUser(r));
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function create(req, res) {
  try {
    const { category, requestType, description, urgency, location, isAnonymous } = req.body ?? {};
    const categories = ['menstrual', 'food', 'hygiene', 'kids', 'transport', 'errands', 'other'];
    const urgencies = ['low', 'medium', 'high'];
    const requestTypes = ['housing', 'health', 'emotional'];
    if (!categories.includes(category)) return err(res, 'Invalid category', 400, 'validation_error');
    if (requestType !== undefined && requestType !== null) {
      if (typeof requestType !== 'string' || !requestTypes.includes(requestType)) {
        return err(res, 'Invalid requestType', 400, 'validation_error');
      }
    }
    if (typeof description !== 'string' || !description.trim()) {
      return err(res, 'description is required', 400, 'validation_error');
    }
    if (!urgencies.includes(urgency)) return err(res, 'Invalid urgency', 400, 'validation_error');
    if (typeof location !== 'string' || !location.trim()) {
      return err(res, 'location is required', 400, 'validation_error');
    }
    if (typeof isAnonymous !== 'boolean') {
      return err(res, 'isAnonymous must be a boolean', 400, 'validation_error');
    }
    const r = await createRequestRow({
      id: nextId('r'),
      userId: req.userId,
      category,
      requestType: requestType ?? null,
      description: description.trim(),
      urgency,
      location: location.trim(),
      status: 'open',
      isAnonymous,
      createdAt: new Date().toISOString(),
    });
    return ok(
      res,
      {
        id: r.id,
        userId: r.userId,
        category: r.category,
        requestType: r.requestType ?? null,
        description: r.description,
        urgency: r.urgency,
        location: r.location,
        status: r.status,
        isAnonymous: r.isAnonymous,
        createdAt: r.createdAt,
      },
      201,
    );
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}

export async function patchStatus(req, res) {
  try {
    const r = await getRequestById(req.params.id);
    if (!r) return err(res, 'Request not found', 404, 'not_found');
    if (r.userId !== req.userId) return err(res, 'Forbidden', 403, 'forbidden');
    const { status } = req.body ?? {};
    if (!['open', 'fulfilled'].includes(status)) {
      return err(res, 'status must be open or fulfilled', 400, 'validation_error');
    }
    await updateRequestStatus(req.params.id, status);
    return ok(res, { id: r.id, status });
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
