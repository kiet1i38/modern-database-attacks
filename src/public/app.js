const form = document.querySelector("#login-form");
const mode = document.querySelector("#mode");
const normalPasswordGroup = document.querySelector("#normal-password-group");
const payloadGroup = document.querySelector("#payload-group");
const username = document.querySelector("#username");
const password = document.querySelector("#password");
const payloadVariant = document.querySelector("#payload-variant");
const result = document.querySelector("#result");
const health = document.querySelector("#health");

function setModeVisibility() {
  const labMode = mode.value === "lab";
  normalPasswordGroup.classList.toggle("hidden", labMode);
  payloadGroup.classList.toggle("hidden", !labMode);
}

function buildRequest() {
  const body = {
    username: username.value
  };

  if (mode.value === "secure") {
    body.password = password.value;
    return {
      endpoint: "/api/auth/login",
      body
    };
  }

  body.password = payloadVariant.value === "brief"
    ? { gt: "" }
    : { $gt: "" };

  return {
    endpoint: "/api/lab/login-observation",
    body
  };
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    health.textContent = data.database === "up"
      ? "HTTP and MongoDB are ready."
      : "HTTP is running, but MongoDB is unavailable.";
    health.className = data.database === "up" ? "health ok" : "health down";
  } catch {
    health.textContent = "The application is not reachable.";
    health.className = "health down";
  }
}

mode.addEventListener("change", setModeVisibility);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.textContent = "Sending request…";

  const { endpoint, body } = buildRequest();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    result.textContent = JSON.stringify({
      httpStatus: response.status,
      request: body,
      response: data
    }, null, 2);
  } catch (error) {
    result.textContent = JSON.stringify({
      error: error.message
    }, null, 2);
  } finally {
    password.value = "";
  }
});

setModeVisibility();
refreshHealth();
