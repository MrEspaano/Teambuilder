import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const getJwtSecret = () => {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error("AUTH_JWT_SECRET saknas eller är för kort (minst 32 tecken).");
  }

  return new TextEncoder().encode(secret);
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const validateCredentials = (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  if (!emailRegex.test(normalizedEmail)) {
    return { ok: false, message: "Ogiltig e-postadress." };
  }

  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, message: "Lösenordet måste vara minst 6 tecken." };
  }

  return { ok: true, email: normalizedEmail };
};

export const hashPassword = async (password) => bcrypt.hash(password, 12);

export const verifyPassword = async (password, hash) => bcrypt.compare(password, hash);

export const createAccessToken = async ({ userId, email }) => {
  const secret = getJwtSecret();
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
};

export const getBearerToken = (req) => {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith("Bearer ")) {
    return null;
  }

  return raw.slice("Bearer ".length).trim();
};

export const verifyAccessToken = async (token) => {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  const userId = payload.sub;
  const email = payload.email;

  if (!userId || typeof email !== "string") {
    throw new Error("Ogiltig token.");
  }

  return {
    userId,
    email
  };
};
