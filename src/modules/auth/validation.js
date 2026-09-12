import { AppError } from "../../shared/errors.js";

const MAX_USERNAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 200;
const MAX_OPERATOR_LIST_LENGTH = 5;
const LAB_OPERATOR_KEYS = new Set([
  "$gt",
  "$gte",
  "$ne",
  "$regex",
  "$nin",
  "$exists"
]);

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

  if (keys.length !== 1 || !LAB_OPERATOR_KEYS.has(keys[0])) {
    throw invalidInput();
  }

  const [operator] = keys;
  const value = password[operator];

  if (operator === "$exists") {
    if (typeof value !== "boolean") {
      throw invalidInput();
    }

    return password;
  }

  if (operator === "$nin") {
    if (
      !Array.isArray(value)
      || value.length < 1
      || value.length > MAX_OPERATOR_LIST_LENGTH
      || value.some((item) => typeof item !== "string" || item.length > MAX_PASSWORD_LENGTH)
    ) {
      throw invalidInput();
    }

    return password;
  }

  if (typeof value !== "string" || value.length > MAX_PASSWORD_LENGTH) {
    throw invalidInput();
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
