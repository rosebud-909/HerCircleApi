import { getUserById } from '../store.js';

export function userPublic(u) {
  return {
    id: u.id,
    name: u.name,
    alias: u.alias ?? null,
    location: u.location ?? null,
    bio: u.bio ?? null,
    verificationStatus: u.verificationStatus,
    createdAt: u.createdAt,
  };
}

export function userMe(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email ?? null,
    alias: u.alias ?? null,
    location: u.location ?? null,
    bio: u.bio ?? null,
    verificationStatus: u.verificationStatus,
    verifiedAt: u.verifiedAt ?? null,
    createdAt: u.createdAt,
  };
}

export async function requestWithUser(r) {
  const base = {
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
  };
  if (r.isAnonymous) {
    base.user = {
      id: 'anonymous',
      name: 'Community member',
      verificationStatus: 'unverified',
    };
    return base;
  }
  const owner = await getUserById(r.userId);
  if (!owner) {
    base.user = {
      id: 'anonymous',
      name: 'Community member',
      verificationStatus: 'unverified',
    };
  } else {
    base.user = {
      id: owner.id,
      name: owner.name,
      verificationStatus: owner.verificationStatus,
    };
  }
  return base;
}
