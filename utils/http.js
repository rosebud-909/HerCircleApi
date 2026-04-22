export function ok(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function err(res, message, status = 400, code = 'bad_request') {
  return res.status(status).json({ error: message, code });
}
