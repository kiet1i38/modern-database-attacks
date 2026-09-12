import { COLLECTIONS } from "../../db/collections.js";
import { isPlainObject } from "./validation.js";
import { verifyPassword } from "./password.js";

function publicUser(user) {
  return {
    username: user.username,
    role: user.role ?? "student"
  };
}

function passwordInputType(password) {
  return isPlainObject(password) ? "object" : "string";
}

function payloadVariant(password) {
  if (!isPlainObject(password)) {
    return "string";
  }

  return Object.keys(password).join(",") || "empty-object";
}

export async function authenticateSecure(database, { username, password }) {
  const user = await database.collection(COLLECTIONS.USERS).findOne({
    username,
    active: true
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return {
      authenticated: false
    };
  }

  return {
    authenticated: true,
    user: publicUser(user)
  };
}

export async function observeLabLogin(database, { username, password }) {
  // Intentionally unsafe and local-only: this route demonstrates why a
  // client-controlled password object must not become part of a secure query.
  const user = await database.collection(COLLECTIONS.LAB_USERS).findOne({
    username,
    password
  });

  return {
    authenticated: Boolean(user),
    user: user ? publicUser(user) : undefined,
    inputType: passwordInputType(password),
    payloadVariant: payloadVariant(password)
  };
}
