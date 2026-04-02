/**
 * @fileoverview Authentication Service
 * @description Handles user authentication, password hashing, and JWT tokens
 */

import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';

import { DEFAULT_DEV_ORG_ID } from '../db/bootstrap.js';
import { db } from '../db/index.js';
import { users, type User, type NewUser } from '../db/schema/users.js';

/** Strip passwordHash from a user record */
function omitPassword(user: User): Omit<User, 'passwordHash'> {
  const {
    id,
    email,
    displayName,
    organizationId,
    role,
    isActive,
    createdAt,
    updatedAt,
    lastLoginAt,
  } = user;
  return {
    id,
    email,
    displayName,
    organizationId,
    role,
    isActive,
    createdAt,
    updatedAt,
    lastLoginAt,
  };
}

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRY = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  organizationId?: string;
  role: string;
}

export interface AuthResult {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for user
 */
export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
  if (user.organizationId != null) {
    payload.organizationId = user.organizationId;
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Create a new user account
 */
export async function createUser(
  email: string,
  password: string,
  displayName: string,
  organizationId?: string
): Promise<AuthResult> {
  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existing.length > 0) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    passwordHash,
    displayName,
    organizationId: organizationId ?? DEFAULT_DEV_ORG_ID,
  };

  const [created] = await db.insert(users).values(newUser).returning();

  if (!created) {
    throw new Error('Failed to create user');
  }

  const token = generateToken(created);

  return { user: omitPassword(created), token };
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const token = generateToken(user);

  return { user: omitPassword(user), token };
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  if (!user) return null;

  return omitPassword(user);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<Omit<User, 'passwordHash'> | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) return null;

  return omitPassword(user);
}
