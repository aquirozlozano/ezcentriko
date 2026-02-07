import { useEffect, useMemo, useRef, useState } from "react";
import * as powerbi from "powerbi-client";
import { models } from "powerbi-client";
import { getEmbedConfig, getReports, login } from "./api.js";

export default function App() {
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [embedError, setEmbedError] = useState("");
  const [embedConfig, setEmbedConfig] = useState(null);
  const reportContainerRef = useRef(null);

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
    if (!reportContainerRef.current) {
      return;
    }

    if (!selectedReport || !embedConfig) {
      powerbiService.reset(reportContainerRef.current);
      return;
    }

    const config = {
      type: "report",
      tokenType: models.TokenType.Embed,
      accessToken: embedConfig.embedToken,
      embedUrl: embedConfig.embedUrl,
      id: embedConfig.reportId,
      settings: {
        panes: {
          filters: { visible: false },
          pageNavigation: { visible: true }
        }
      }
    };

    powerbiService.embed(reportContainerRef.current, config);
  }, [embedConfig, powerbiService, selectedReport]);

  const logout = () => {
    setUser(null);
    setToken("");
    setEmbedConfig(null);
    setEmbedError("");
  };

  useEffect(() => {
    if (!selectedReport || !token) {
      setEmbedConfig(null);
      return;
    }

    setEmbedError("");
    getEmbedConfig(token, selectedReport.id)
      .then((data) => {
        setEmbedConfig(data);
      })
      .catch((error) => {
        setEmbedError(error.message);
      });
  }, [selectedReport, token]);

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
          {embedError ? (
            <div className="viewer-placeholder">
              {embedError}
            </div>
          ) : !embedConfig ? (
            <div className="viewer-placeholder">
              Conectando Power BI...
            </div>
          ) : selectedReport ? (
            <div ref={reportContainerRef} className="report-frame" />
          ) : (
            <div className="viewer-placeholder">
              Selecciona un reporte para verlo.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
