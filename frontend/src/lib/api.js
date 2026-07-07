const API_URL = import.meta.env.VITE_API_URL;

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
}

function storeSession(data, fallbackEmail, fallbackName) {
  if (data?.session?.access_token) {
    localStorage.setItem("access_token", data.session.access_token);
  }
  if (data?.session?.refresh_token) {
    localStorage.setItem("refresh_token", data.session.refresh_token);
  }
  const displayName = data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || fallbackName;
  if (displayName) {
    localStorage.setItem("user_name", displayName);
  }
  if (data?.user?.email || fallbackEmail) {
    localStorage.setItem("user_email", data?.user?.email || fallbackEmail);
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");

  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const data = await response.json();

  if (!response.ok || !data?.session?.access_token) {
    return false;
  }

  storeSession(data);
  return true;
}

export async function apiRequest(endpoint, options = {}, hasRetried = false) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (response.status === 401 || data.error === "Invalid or expired token") {
    if (!hasRetried && await refreshAccessToken()) {
      return apiRequest(endpoint, options, true);
    }

    clearSession();
    window.location.href = "/";
    return;
  }

  if (!response.ok) {
    const errorMessage =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || JSON.stringify(data.error) || "Something went wrong";
    throw new Error(errorMessage);
  }

  return data;
}

export async function signup(email, password, fullName) {
  const data = await apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });
  storeSession(data, email, fullName);
  return data;
}

export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  storeSession(data, email);
  return data;
}
