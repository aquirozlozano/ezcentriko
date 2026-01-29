import { useEffect, useMemo, useRef, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import * as powerbi from "powerbi-client";
import { models } from "powerbi-client";
import { getReports, login } from "./api.js";
import { parsePowerBiReport } from "./powerbi.js";

export default function App() {
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [pbiError, setPbiError] = useState("");
  const [pbiAccessToken, setPbiAccessToken] = useState("");
  const reportContainerRef = useRef(null);

  const msalInstance = useMemo(() => {
    const clientId = import.meta.env.VITE_AAD_CLIENT_ID;
    const tenantId = import.meta.env.VITE_AAD_TENANT_ID;
    if (!clientId || !tenantId) {
      return null;
    }

    return new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: "sessionStorage"
      }
    });
  }, []);

  const powerbiService = useMemo(() => {
    return new powerbi.service.Service(
      powerbi.factories.hpmFactory,
      powerbi.factories.wpmpFactory,
      powerbi.factories.routerFactory
    );
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    const formData = new FormData(event.target);
    try {
      const data = await login(formData.get("email"), formData.get("password"));
      setUser(data.user);
      setToken(data.token);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  useEffect(() => {
    if (!token) {
      setReports([]);
      setSelectedReport(null);
      return;
    }

    getReports(token)
      .then((data) => {
        setReports(data.reports || []);
        setReportError("");
      })
      .catch((error) => setReportError(error.message));
  }, [token]);

  useEffect(() => {
    if (!msalInstance) {
      return;
    }

    msalInstance.initialize().catch((error) => {
      console.error(error);
      setPbiError("No se pudo inicializar Power BI.");
    });
  }, [msalInstance]);

  useEffect(() => {
    if (!reportContainerRef.current) {
      return;
    }

    if (!selectedReport || !pbiAccessToken) {
      powerbiService.reset(reportContainerRef.current);
      return;
    }

    const { reportId, embedUrl } = parsePowerBiReport(
      selectedReport.embed_url || ""
    );

    if (!reportId || !embedUrl) {
      setReportError(
        "El enlace del reporte no es valido para Power BI embed."
      );
      powerbiService.reset(reportContainerRef.current);
      return;
    }

    const config = {
      type: "report",
      tokenType: models.TokenType.Aad,
      accessToken: pbiAccessToken,
      embedUrl,
      id: reportId,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true }
        }
      }
    };

    powerbiService.embed(reportContainerRef.current, config);
  }, [pbiAccessToken, powerbiService, selectedReport]);

  const logout = () => {
    setUser(null);
    setToken("");
  };

  const connectPowerBi = async () => {
    if (!msalInstance) {
      setPbiError(
        "Configura VITE_AAD_CLIENT_ID y VITE_AAD_TENANT_ID en el frontend."
      );
      return;
    }

    const rawScopes = import.meta.env.VITE_PBI_SCOPES || "";
    const scopes = rawScopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);

    if (!scopes.length) {
      setPbiError("Configura VITE_PBI_SCOPES para Power BI.");
      return;
    }

    try {
      setPbiError("");
      const loginResponse = await msalInstance.loginPopup({ scopes });
      const account = loginResponse.account;

      if (!account) {
        setPbiError("No se pudo obtener la cuenta de Power BI.");
        return;
      }

      const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes,
        account
      });
      setPbiAccessToken(tokenResponse.accessToken);
    } catch (error) {
      console.error(error);
      try {
        const tokenResponse = await msalInstance.acquireTokenPopup({ scopes });
        setPbiAccessToken(tokenResponse.accessToken);
      } catch (popupError) {
        console.error(popupError);
        setPbiError("No se pudo autenticar con Power BI.");
      }
    }
  };

  const disconnectPowerBi = () => {
    setPbiAccessToken("");
  };

  if (!user) {
    return (
      <div className="app login-page">
        <header className="login-hero">
          <p className="eyebrow">EZ Centriko</p>
          <h1>Cargamos, procesamos y transformamos para ti</h1>
        </header>

        <section className="login-card">
          <div>
            <p className="tag">Acceso</p>
            <form onSubmit={handleLogin} className="form">
              <input name="email" type="email" placeholder="Correo" required />
              <input
                name="password"
                type="password"
                placeholder="Contrasena"
                required
              />
              <button type="submit">Entrar</button>
            </form>
            {authError ? <p className="error">{authError}</p> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app dashboard">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">EZ Centriko</p>
          <h1>{user.company_name || "Reportes"}</h1>
        </div>
        <div className="user-info">
          <div className="pbi-auth">
            <button
              className="ghost"
              type="button"
              onClick={pbiAccessToken ? disconnectPowerBi : connectPowerBi}
            >
              {pbiAccessToken ? "Desconectar Power BI" : "Conectar Power BI"}
            </button>
          </div>
          <span>{user.name}</span>
          <button className="ghost" type="button" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="dashboard-body">
        <aside className="report-panel">
          <div className="panel-header">
            <h2>Lista de reportes</h2>
          </div>
          <div className="report-list">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                className={
                  selectedReport?.id === report.id
                    ? "report-item active"
                    : "report-item"
                }
                onClick={() => setSelectedReport(report)}
              >
                <span className="report-icon" aria-hidden="true">
                  {report.name?.slice(0, 1) || "R"}
                </span>
                <span className="report-text">
                  <span className="report-title">{report.name}</span>
                  <span className="report-meta">Ver detalle</span>
                </span>
              </button>
            ))}
            {!reports.length ? (
              <p className="muted">No hay reportes disponibles.</p>
            ) : null}
          </div>
          {reportError ? <p className="error">{reportError}</p> : null}
        </aside>

        <section className="viewer">
          <div className="panel-header">
            <h2>Vista previa</h2>
          </div>
          {!pbiAccessToken ? (
            <div className="viewer-placeholder">
              Conecta Power BI para ver los reportes.
            </div>
          ) : selectedReport ? (
            <div ref={reportContainerRef} className="report-frame" />
          ) : (
            <div className="viewer-placeholder">
              Selecciona un reporte para verlo.
            </div>
          )}
          {pbiError ? <p className="error">{pbiError}</p> : null}
        </section>
      </main>
    </div>
  );
}
