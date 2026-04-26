import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

function skipRateLimit() {
  return (
    process.env.NODE_ENV === 'test' ||
    process.env.ALLOW_TEST_AUTH === 'true' ||
    process.env.DISABLE_RATE_LIMIT === 'true'
  );
}

function rateJson429(_req, res) {
  res.status(429).json({ error: 'Too many requests', code: 'rate_limited' });
}

const common = {
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateJson429,
};

function keyUserOrIp(req) {
  const uid = req.userId;
  if (uid) return `u:${uid}`;
  return ipKeyGenerator(req.ip || '');
}

/** POST /auth/register — 5 per hour per IP */
export const authRegisterLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
});

/** POST /auth/google — 10 per hour per IP */
export const authGoogleLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
});

/** POST /sos — 3 per hour per user */
export const sosCreateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: keyUserOrIp,
});

/** POST /verification/submit — 3 per day per user (counts successful submits only) */
export const verificationSubmitLimiter = rateLimit({
  ...common,
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  keyGenerator: keyUserOrIp,
  // Do not burn quota on server errors / validation failures while users (or ops) are debugging.
  skipFailedRequests: true,
});

/** POST /chats — 20 per minute per user */
export const chatsCreateLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: keyUserOrIp,
});

/** POST /chats/:chatId/messages — 60 per minute per user */
export const chatsMessageLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: keyUserOrIp,
});

/** GET /community/members — 30 per minute per user */
export const communityMembersLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: keyUserOrIp,
});

/** GET /location/postal — public; 60 per minute per IP (Zippopotam + server cache) */
export const postalLocationLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
});
