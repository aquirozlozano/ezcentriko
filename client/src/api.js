const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

export async function login(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function register(name, email, password) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
}

export async function getReports(token) {
  return request("/api/reports", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function getEmbedConfig(token, reportId) {
  return request(`/api/powerbi/embed/${reportId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function createReport(token, report) {
  return request("/api/reports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(report)
  });
}
