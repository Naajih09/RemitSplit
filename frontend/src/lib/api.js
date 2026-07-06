const API_URL = import.meta.env.VITE_API_URL;

export async function apiRequest(endpoint, options = {}) {
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
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_email");
    window.location.href = "/";
    return;
  }

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

export async function signup(email, password) {
  const data = await apiRequest("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.session?.access_token) {
    localStorage.setItem("access_token", data.session.access_token);
  }
  if (data.user?.email || email) {
    localStorage.setItem("user_email", data.user?.email || email);
  }
  return data;
}

export async function login(email, password) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data?.session?.access_token) {
    localStorage.setItem("access_token", data.session.access_token);
  }
  if (data?.user?.email || email) {
    localStorage.setItem("user_email", data?.user?.email || email);
  }
  return data;
}
