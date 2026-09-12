import { AppError } from "../../shared/errors.js";

const MAX_USERNAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 200;

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidInput(message = "Invalid request") {
  return new AppError(message, {
    statusCode: 400,
    code: "INVALID_INPUT"
  });
}

function ensureBodyObject(body) {
  if (!isPlainObject(body)) {
    throw invalidInput();
  }
}

function ensureAllowedKeys(body) {
  const keys = Object.keys(body);

  if (keys.length !== 2 || !keys.includes("username") || !keys.includes("password")) {
    throw invalidInput();
  }
}

function validateUsername(username) {
  if (
    typeof username !== "string"
    || username.length < 1
    || username.length > MAX_USERNAME_LENGTH
  ) {
    throw invalidInput();
  }

  return username.trim().toLowerCase();
}

function validateStringPassword(password) {
  if (
    typeof password !== "string"
    || password.length < 1
    || password.length > MAX_PASSWORD_LENGTH
  ) {
    throw invalidInput();
  }

  return password;
}

function validateLabPassword(password) {
  if (typeof password === "string") {
    return validateStringPassword(password);
  }

  if (!isPlainObject(password)) {
    throw invalidInput();
  }

  const keys = Object.keys(password);

  if (keys.length === 0 || keys.length > 3) {
    throw invalidInput();
  }

  for (const value of Object.values(password)) {
    if (typeof value !== "string" || value.length > MAX_PASSWORD_LENGTH) {
      throw invalidInput();
    }
  }

  return password;
}

export function validateSecureLoginBody(body) {
  ensureBodyObject(body);
  ensureAllowedKeys(body);

  return {
    username: validateUsername(body.username),
    password: validateStringPassword(body.password)
  };
}

export function validateLabLoginBody(body) {
  ensureBodyObject(body);
  ensureAllowedKeys(body);

  return {
    username: validateUsername(body.username),
    password: validateLabPassword(body.password)
  };
}
