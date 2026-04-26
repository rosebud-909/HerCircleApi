import { resolvePostalToLocation } from '../services/zipLocationResolve.js';
import { ok, err } from '../utils/http.js';

export async function getPostalLocation(req, res) {
  const country = req.query.country;
  const postal = req.query.postal;
  if (typeof country !== 'string' || !country.trim()) {
    return err(res, 'country is required', 400, 'validation_error');
  }
  if (typeof postal !== 'string' || !postal.trim()) {
    return err(res, 'postal is required', 400, 'validation_error');
  }
  try {
    const result = await resolvePostalToLocation(country, postal);
    return ok(res, result);
  } catch (_e) {
    return err(res, 'Internal error', 500, 'internal');
  }
}
