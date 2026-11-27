import { z } from "zod";
import { query } from "../config/db.js";
import { recordAudit } from "../services/audit.service.js";
import {
  clearSession,
  issueSession,
  readSession,
  SESSION_COOKIE,
} from "../services/session.service.js";
import { findStudentForSignup } from "../services/student.service.js";
import {
  changePassword,
  createStudentUser,
  revokeSessions,
  saveOnboarding,
  toMe,
  verifyCredentials,
} from "../services/user.service.js";
import { AppError } from "../utils/AppError.js";

// What a login request may contain: a username (case and spaces ignored) and a password.
export const loginSchema = z.strictObject({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(128),
});

const universityId = z.string().trim().min(1).max(32);

// Signup step 1: just the university ID.
export const lookupSchema = z.strictObject({ university_id: universityId });

// Signup step 2: the university ID again, plus the username and password the student picks.
export const signupSchema = z.strictObject({
  university_id: universityId,
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,64}$/,
      "3 to 64 characters: letters, digits, dot, dash or underscore",
    ),
  password: z.string().min(8).max(128),
});

// Onboarding/profile fields. All optional, so the profile page can save just some of them.
export const onboardingSchema = z.strictObject({
  full_name: z.string().trim().min(1).max(200).optional(),
  birthdate: z.iso.date().optional(),
  preferred_language: z.enum(["en", "ar"]).optional(),
  preferred_theme: z.enum(["light", "dark"]).optional(),
});

// A password change: the current password, and a new one of 8-128 characters that differs.
export const changePasswordSchema = z
  .strictObject({
    current_password: z.string().min(1).max(128),
    new_password: z.string().min(8).max(128),
  })
  .refine((body) => body.new_password !== body.current_password, {
    path: ["new_password"],
    message: "The new password must differ from the current one.",
  });

// PATCH /api/me/password: changes the signed-in user's password. A wrong current password
// is a 400 on that field (not 401, which would read as "signed out"). Every other session
// of the user ends; this browser gets a fresh cookie so the user stays signed in. Audited.
export async function updatePassword(req, res) {
  const { current_password, new_password } = req.body;
  const user = await changePassword(
    req.user.id,
    current_password,
    new_password,
  );
  if (!user) {
    throw new AppError(
      400,
      "VALIDATION_FAILED",
      "The current password is not right.",
      [
        {
          path: "current_password",
          message: "The current password is not right.",
          code: "incorrect",
        },
      ],
    );
  }
  issueSession(res, user);
  await recordAudit(
    { query },
    req,
    "auth.password_changed",
    { type: "app_user", id: user.id, label: user.username },
    `${user.username} changed their password.`,
  );
  res.json({ user: toMe(user) });
}

// POST /api/auth/login: the same login for every role.
// Right username and password: sets the session cookie and returns the user.
// Wrong either one: 401. Deactivated account: 403.
export async function login(req, res) {
  const { username, password } = req.body;
  const user = await verifyCredentials(username, password);
  if (!user || !user.is_active) {
    await recordAudit(
      { query },
      req,
      "auth.login_failed",
      { type: "app_user", id: user?.id ?? null, label: username },
      user
        ? `Sign-in refused: ${username} is deactivated.`
        : `Failed sign-in for ${username}.`,
      { severity: "warning", outcome: "failure", usernameAttempted: username },
    );
  }
  if (!user) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Username or password is incorrect.",
    );
  }
  if (!user.is_active) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account is deactivated.");
  }
  issueSession(res, user);
  await recordAudit(
    { query },
    req,
    "auth.login",
    { type: "app_user", id: user.id, label: user.username },
    `${user.username} signed in.`,
    { actor: user },
  );
  res.json({ user: toMe(user) });
}

// POST /api/auth/logout: revokes the session on the server (the token can never be used
// again, even if it was copied) and deletes the cookie. Always answers 204, even when the
// session had already expired, so the browser is never left holding a cookie.
export async function logout(req, res) {
  const session = readSession(req.cookies?.[SESSION_COOKIE]);
  if (session) {
    await revokeSessions(session.userId);
    const {
      rows: [actor],
    } = await query(
      "SELECT id, username, full_name, role FROM app_user WHERE id = $1",
      [session.userId],
    );
    if (actor) {
      await recordAudit(
        { query },
        req,
        "auth.logout",
        { type: "app_user", id: actor.id, label: actor.username },
        `${actor.username} signed out.`,
        { actor },
      );
    }
  }
  clearSession(res);
  res.status(204).end();
}

// GET /api/me: who is signed in. The frontend uses it to guard pages by role.
export function me(req, res) {
  res.json({ user: toMe(req.user) });
}

// Finds the student for a signup, or stops with 404 (ID not in the records)
// or 409 (this student already has an account).
async function studentAllowedToSignUp(universityIdValue) {
  const student = await findStudentForSignup(universityIdValue);
  if (!student) {
    throw new AppError(
      404,
      "STUDENT_NOT_FOUND",
      "This university ID is not in the student record.",
    );
  }
  if (student.has_account) throw alreadyLinked();
  return student;
}

// 409: this student already has an account.
const alreadyLinked = () =>
  new AppError(
    409,
    "ALREADY_LINKED",
    "An account already exists for this university ID.",
  );

// POST /api/auth/signup/lookup: checks that the university ID is a known student
// without an account yet, before the student picks a username and password.
export async function signupLookup(req, res) {
  const student = await studentAllowedToSignUp(req.body.university_id);
  res.json({
    university_id: student.university_id,
    cohort_year: student.cohort_year,
  });
}

// POST /api/auth/signup: creates the student's account and signs them in.
// Errors: 404 unknown ID, 409 ID already has an account, 409 username taken.
export async function signup(req, res) {
  const { university_id, username, password } = req.body;
  const student = await studentAllowedToSignUp(university_id);

  let user;
  try {
    user = await createStudentUser(student.id, username, password);
  } catch (err) {
    // Unique keys catch the race where someone else signed up a moment earlier.
    if (err.constraint === "app_user_student_id_key") throw alreadyLinked();
    if (err.constraint === "app_user_username_key") {
      throw new AppError(409, "USERNAME_TAKEN", "This username is taken.");
    }
    throw err;
  }

  issueSession(res, user);
  res.status(201).json({ user: toMe(user) });
}

// PATCH /api/me/onboarding: saves name, birthdate, language and theme for the
// signed-in user (any role). The user is always the session, never the body.
export async function onboarding(req, res) {
  const user = await saveOnboarding(req.user.id, req.body);
  res.json({ user: toMe(user) });
}
