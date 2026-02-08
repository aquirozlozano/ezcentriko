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

export async function getOrchestrations(token) {
  return request("/api/orchestrations", {
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

export async function createOrchestration(token, orchestration) {
  return request("/api/orchestrations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(orchestration)
  });
}

export async function updateOrchestrationDestinations(token, id, destinations) {
  return request(`/api/orchestrations/${id}/destinations`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ destinations })
  });
}

export async function updateOrchestrationDetails(token, id, details) {
  return request(`/api/orchestrations/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(details)
  });
}

export async function updateOrchestrationStatus(token, id, status) {
  return request(`/api/orchestrations/${id}/status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status })
  });
}

export async function deleteOrchestration(token, id) {
  return request(`/api/orchestrations/${id}`, {
    method: "DELETE",
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
