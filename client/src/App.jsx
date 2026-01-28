import { useEffect, useRef, useState } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { factories, models, service } from "powerbi-client";
import { createReport, getReports, login, register } from "./api.js";

const API_SCOPES = (import.meta.env.VITE_PBI_SCOPES || "")
  .split(" ")
  .filter(Boolean);

const aadClientId = import.meta.env.VITE_AAD_CLIENT_ID;
const tenantId = import.meta.env.VITE_AAD_TENANT_ID;

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: aadClientId,
    authority: tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : "https://login.microsoftonline.com/common",
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: "sessionStorage"
  }
});

const powerbiService = new service.Service(
  factories.hpmFactory,
  factories.wpmpFactory,
  factories.routerFactory
);

const emptyReport = {
  reportId: "",
  name: "",
  embedUrl: ""
};

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportForm, setReportForm] = useState(emptyReport);
  const [reportError, setReportError] = useState("");
  const [msalAccount, setMsalAccount] = useState(null);
  const [powerBiToken, setPowerBiToken] = useState("");
  const embedRef = useRef(null);

  const msalReady = Boolean(aadClientId);

  useEffect(() => {
    if (!token) {
      setReports([]);
      return;
    }

    getReports(token)
      .then((data) => setReports(data.reports || []))
      .catch((error) => setReportError(error.message));
  }, [token]);

  useEffect(() => {
    if (!selectedReport || !powerBiToken || !embedRef.current) {
      return;
    }

    powerbiService.reset(embedRef.current);
    powerbiService.embed(embedRef.current, {
      type: "report",
      id: selectedReport.report_id,
      embedUrl: selectedReport.embed_url,
      accessToken: powerBiToken,
      tokenType: models.TokenType.Aad,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true }
        },
        background: models.BackgroundType.Transparent
      }
    });
  }, [selectedReport, powerBiToken]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    const formData = new FormData(event.target);
    try {
      const data = await login(formData.get("email"), formData.get("password"));
      setToken(data.token);
      setUser(data.user);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setAuthError("");
    const formData = new FormData(event.target);
    try {
      const data = await register(
        formData.get("name"),
        formData.get("email"),
        formData.get("password")
      );
      setToken(data.token);
      setUser(data.user);
      setAuthMode("login");
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleAddReport = async (event) => {
    event.preventDefault();
    setReportError("");
    try {
      const data = await createReport(token, reportForm);
      setReports((prev) => [...prev, data.report]);
      setReportForm(emptyReport);
    } catch (error) {
      setReportError(error.message);
    }
  };

  const connectPowerBI = async () => {
    if (!msalReady) {
      setReportError("Configura VITE_AAD_CLIENT_ID y VITE_AAD_TENANT_ID");
      return;
    }

    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: API_SCOPES
      });
      const account = loginResponse.account;
      setMsalAccount(account);

      const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: API_SCOPES,
        account
      });

      setPowerBiToken(tokenResponse.accessToken);
    } catch (error) {
      setReportError("No se pudo autenticar con Microsoft.");
    }
  };

  const logout = () => {
    setToken("");
    setUser(null);
    setSelectedReport(null);
    setPowerBiToken("");
  };

  const readyToEmbed = Boolean(selectedReport && powerBiToken);

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">EZ Centriko</p>
          <h1>
            Reportes Power BI
            <span> en un solo lugar</span>
          </h1>
          <p className="subtitle">
            Login interno con base de datos, catálogo de reportes y
            embebido seguro con Microsoft Entra ID.
          </p>
        </div>
        <div className="hero-card">
          {user ? (
            <div>
              <p className="tag">Sesión activa</p>
              <h3>{user.name}</h3>
              <p className="muted">{user.email}</p>
              <button className="ghost" type="button" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div>
              <p className="tag">Acceso</p>
              <div className="tabs">
                <button
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                  type="button"
                >
                  Ingresar
                </button>
                <button
                  className={authMode === "register" ? "active" : ""}
                  onClick={() => setAuthMode("register")}
                  type="button"
                >
                  Registrar
                </button>
              </div>
              {authMode === "login" ? (
                <form onSubmit={handleLogin} className="form">
                  <input name="email" type="email" placeholder="Correo" required />
                  <input
                    name="password"
                    type="password"
                    placeholder="Contraseña"
                    required
                  />
                  <button type="submit">Entrar</button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="form">
                  <input name="name" type="text" placeholder="Nombre" required />
                  <input name="email" type="email" placeholder="Correo" required />
                  <input
                    name="password"
                    type="password"
                    placeholder="Contraseña"
                    required
                  />
                  <button type="submit">Crear cuenta</button>
                </form>
              )}
              {authError ? <p className="error">{authError}</p> : null}
            </div>
          )}
        </div>
      </header>

      <main className="main">
        <section className="panel">
          <div className="panel-header">
            <h2>Reportes</h2>
            <p className="muted">Selecciona un reporte para embebido.</p>
          </div>
          {user ? (
            <div className="panel-body">
              <div className="report-list">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    className={
                      selectedReport?.id === report.id
                        ? "report-item active"
                        : "report-item"
                    }
                    onClick={() => setSelectedReport(report)}
                    type="button"
                  >
                    <span>{report.name}</span>
                    <small>{report.report_id}</small>
                  </button>
                ))}
                {reports.length === 0 ? (
                  <p className="empty">Aun no tienes reportes cargados.</p>
                ) : null}
              </div>

              <div className="divider"></div>

              <form className="form" onSubmit={handleAddReport}>
                <h3>Agregar reporte</h3>
                <input
                  name="name"
                  type="text"
                  placeholder="Nombre"
                  value={reportForm.name}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      name: event.target.value
                    }))
                  }
                  required
                />
                <input
                  name="reportId"
                  type="text"
                  placeholder="Report ID"
                  value={reportForm.reportId}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      reportId: event.target.value
                    }))
                  }
                  required
                />
                <input
                  name="embedUrl"
                  type="url"
                  placeholder="Embed URL"
                  value={reportForm.embedUrl}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      embedUrl: event.target.value
                    }))
                  }
                  required
                />
                <button type="submit">Guardar</button>
                {reportError ? <p className="error">{reportError}</p> : null}
              </form>
            </div>
          ) : (
            <div className="panel-body">
              <p className="empty">Inicia sesión para ver tus reportes.</p>
            </div>
          )}
        </section>

        <section className="viewer">
          <div className="viewer-header">
            <h2>Vista previa</h2>
            <div className="viewer-actions">
              {user ? (
                <button className="ghost" onClick={connectPowerBI} type="button">
                  {msalAccount ? "Refrescar Microsoft" : "Conectar Microsoft"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="viewer-body">
            {!selectedReport ? (
              <div className="placeholder">
                <p>Selecciona un reporte para comenzar.</p>
              </div>
            ) : !powerBiToken ? (
              <div className="placeholder">
                <p>
                  Conecta tu cuenta Microsoft para cargar el reporte con tu
                  licencia Pro.
                </p>
                <button onClick={connectPowerBI} type="button">
                  Conectar Microsoft
                </button>
              </div>
            ) : (
              <div className="embed" ref={embedRef}></div>
            )}
          </div>

          {readyToEmbed ? (
            <p className="muted small">
              Embed activo: {selectedReport.name}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
