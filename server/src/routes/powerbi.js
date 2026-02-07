import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const POWER_BI_SCOPE = "https://analysis.windows.net/powerbi/api/.default";

async function getAccessToken() {
  const tenantId = process.env.PBI_TENANT_ID;
  const clientId = process.env.PBI_CLIENT_ID;
  const clientSecret = process.env.PBI_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Power BI service principal config");
  }

  const form = new URLSearchParams();
  form.append("client_id", clientId);
  form.append("client_secret", clientSecret);
  form.append("scope", POWER_BI_SCOPE);
  form.append("grant_type", "client_credentials");

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function parseReportId(embedUrl) {
  try {
    const url = new URL(embedUrl);
    const reportId = url.searchParams.get("reportId");
    if (reportId) {
      return reportId;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const reportsIndex = parts.indexOf("reports");
    return reportsIndex >= 0 ? parts[reportsIndex + 1] : null;
  } catch {
    return null;
  }
}

router.get("/embed/:id", requireAuth, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isFinite(reportId)) {
    return res.status(400).json({ error: "Invalid report id" });
  }

  const result = await query(
    "SELECT id, name, embed_url FROM reports WHERE id = $1",
    [reportId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Report not found" });
  }

  const report = result.rows[0];
  const reportGuid = parseReportId(report.embed_url);
  const workspaceId = process.env.PBI_WORKSPACE_ID;

  if (!reportGuid || !workspaceId) {
    return res.status(400).json({
      error: "Missing reportId or workspace config for Power BI embed"
    });
  }

  const accessToken = await getAccessToken();

  const reportRes = await fetch(
    `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportGuid}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!reportRes.ok) {
    const text = await reportRes.text();
    return res.status(502).json({ error: `Report lookup failed: ${text}` });
  }

  const reportInfo = await reportRes.json();

  const tokenRes = await fetch(
    "https://api.powerbi.com/v1.0/myorg/GenerateToken",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessLevel: "view",
        reports: [{ id: reportGuid }],
        datasets: [{ id: reportInfo.datasetId }],
        targetWorkspaces: [{ id: workspaceId }]
      })
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return res.status(502).json({ error: `Embed token failed: ${text}` });
  }

  const tokenData = await tokenRes.json();

  return res.json({
    reportId: reportGuid,
    embedUrl: reportInfo.embedUrl,
    embedToken: tokenData.token
  });
});

export default router;
