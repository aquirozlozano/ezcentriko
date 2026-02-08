import { useEffect, useMemo, useRef, useState } from "react";
import * as powerbi from "powerbi-client";
import { models } from "powerbi-client";
import {
  createOrchestration,
  getHistory,
  getEmbedConfig,
  getOrchestrations,
  getReports,
  login,
  updateOrchestrationDetails,
  updateOrchestrationStatus,
  updateOrchestrationDestinations,
  deleteOrchestration
} from "./api.js";
import logo from "./assets/ezcentriko-logo.svg";

export default function App() {
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [embedError, setEmbedError] = useState("");
  const [embedConfig, setEmbedConfig] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const [activeView, setActiveView] = useState("reports");
  const [orchestrations, setOrchestrations] = useState([]);
  const [orchError, setOrchError] = useState("");
  const [orchForm, setOrchForm] = useState({
    name: "",
    reportId: "",
    destinations: "",
    cron: "",
    timezone: "America/Lima"
  });
  const reportContainerRef = useRef(null);
  const embeddedReportRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");

  const isCronValid = (value) => {
    if (!value) return false;
    const parts = value.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    return parts.every((part) => /^[\d*/,-]+$/.test(part));
  };

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
    if (!token) {
      setOrchestrations([]);
      return;
    }

    getOrchestrations(token)
      .then((data) => {
        setOrchestrations(data.orchestrations || []);
        setOrchError("");
      })
      .catch((error) => setOrchError(error.message));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setHistory([]);
      return;
    }

    getHistory(token)
      .then((data) => {
        setHistory(data.history || []);
        setHistoryError("");
      })
      .catch((error) => setHistoryError(error.message));
  }, [token]);

  useEffect(() => {
    if (!reportContainerRef.current) {
      return;
    }

    if (!selectedReport || !embedConfig) {
      powerbiService.reset(reportContainerRef.current);
      embeddedReportRef.current = null;
      setReportReady(false);
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

    const embedded = powerbiService.embed(
      reportContainerRef.current,
      config
    );
    embeddedReportRef.current = embedded;
    setReportReady(false);
    embedded.off("loaded");
    embedded.on("loaded", async () => {
      setReportReady(true);
    });
  }, [embedConfig, powerbiService, selectedReport]);

  const logout = () => {
    setUser(null);
    setToken("");
    setEmbedConfig(null);
    setEmbedError("");
    setReportReady(false);
  };

  const handleFullscreen = () => {
    embeddedReportRef.current?.fullscreen?.();
  };

  const handleDownload = () => {
    embeddedReportRef.current?.print?.();
  };

  const handleShare = async () => {
    if (!embedConfig?.embedUrl) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: selectedReport?.name || "Reporte",
          url: embedConfig.embedUrl
        });
        return;
      } catch {
        // ignore and fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(embedConfig.embedUrl);
      window.alert("Enlace copiado.");
    } catch {
      window.alert("No se pudo copiar el enlace.");
    }
  };

  const handleOrchChange = (field) => (event) => {
    setOrchForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleCreateOrchestration = async () => {
    if (!orchForm.name || !orchForm.reportId || !orchForm.destinations || !orchForm.cron) {
      setOrchError("Completa nombre, reporte, destinos y cron.");
      return;
    }
    if (!isCronValid(orchForm.cron)) {
      setOrchError("El cron no es valido. Usa 5 campos (min hora dia mes dia_sem).");
      return;
    }

    try {
      const data = await createOrchestration(token, {
        name: orchForm.name,
        reportId: Number(orchForm.reportId),
        destinations: orchForm.destinations,
        cron: orchForm.cron,
        timezone: orchForm.timezone
      });
      setOrchestrations((prev) => [data.orchestration, ...prev]);
      setOrchForm({
        name: "",
        reportId: "",
        destinations: "",
        cron: "",
        timezone: orchForm.timezone || "America/Lima"
      });
      setOrchError("");
    } catch (error) {
      setOrchError(error.message);
    }
  };

  const handleDestinationsChange = (id, value) => {
    setOrchestrations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, destinations: value } : item
      )
    );
  };

  const handleDestinationsBlur = async (id, value) => {
    try {
      const data = await updateOrchestrationDestinations(token, id, value);
      setOrchestrations((prev) =>
        prev.map((item) => (item.id === id ? data.orchestration : item))
      );
    } catch (error) {
      setOrchError(error.message);
    }
  };

  const handleFieldChange = (id, field, value) => {
    setOrchestrations((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleDetailsBlur = async (item) => {
    if (item.cron && !isCronValid(item.cron)) {
      setOrchError("El cron no es valido. Usa 5 campos (min hora dia mes dia_sem).");
      return;
    }
    try {
      const data = await updateOrchestrationDetails(token, item.id, {
        name: item.name,
        cron: item.cron
      });
      setOrchestrations((prev) =>
        prev.map((row) => (row.id === item.id ? data.orchestration : row))
      );
    } catch (error) {
      setOrchError(error.message);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === "activo" ? "pausado" : "activo";
    try {
      const data = await updateOrchestrationStatus(
        token,
        item.id,
        nextStatus
      );
      setOrchestrations((prev) =>
        prev.map((row) => (row.id === item.id ? data.orchestration : row))
      );
    } catch (error) {
      setOrchError(error.message);
    }
  };

  const handleDeleteOrchestration = async (item) => {
    const confirmed = window.confirm(
      `Eliminar la orquestacion "${item.name}"?`
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteOrchestration(token, item.id);
      setOrchestrations((prev) => prev.filter((row) => row.id !== item.id));
    } catch (error) {
      setOrchError(error.message);
    }
  };

  useEffect(() => {
    if (!selectedReport || !token) {
    setEmbedConfig(null);
    setReportReady(false);
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
          <div className="brand">
            <img className="brand-logo" src={logo} alt="EZCentriko" />
            <span className="brand-name">EZCentriko</span>
          </div>
          <h1 className="slogan-line">
            Cargamos, procesamos y transformamos para ti
          </h1>
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
        <div className="dashboard-title">
          <h1>{user.company_name || "Reportes"}</h1>
        </div>
        <div className="dashboard-brand">
          <div className="brand">
            <img className="brand-logo" src={logo} alt="EZCentriko" />
            <span className="brand-name">EZCentriko</span>
          </div>
        </div>
        <div className="user-info">
          <span>{user.name}</span>
          <button className="ghost" type="button" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <nav className="view-tabs" role="tablist" aria-label="Vistas">
        {[
          { key: "reports", label: "Reportes" },
          { key: "orchestrator", label: "Orquestador" },
          { key: "history", label: "Historial" }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeView === tab.key}
            className={
              activeView === tab.key ? "view-tab active" : "view-tab"
            }
            onClick={() => setActiveView(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeView === "reports" ? (
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
              <div className="panel-actions">
                <button
                  type="button"
                  className="ghost icon-button"
                  onClick={handleFullscreen}
                  disabled={!reportReady}
                  title="Pantalla completa"
                  aria-label="Pantalla completa"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ghost icon-button"
                  onClick={handleDownload}
                  disabled={!reportReady}
                  title="Descargar"
                  aria-label="Descargar"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 4v10m0 0l-4-4m4 4l4-4M5 20h14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ghost icon-button"
                  onClick={handleShare}
                  disabled={!embedConfig?.embedUrl}
                  title="Compartir"
                  aria-label="Compartir"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 12h8M12 8l4 4-4 4M4 6v12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
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
      ) : activeView === "orchestrator" ? (
        <main className="dashboard-body single">
          <section className="viewer">
            <div className="panel-header">
              <h2>Orquestador</h2>
            </div>
            <div className="orchestrator-grid">
              <div className="orchestrator-form">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    type="text"
                    placeholder="Ej. Reporte semanal"
                    value={orchForm.name}
                    onChange={handleOrchChange("name")}
                  />
                </div>
                <div className="field">
                  <label>Reporte</label>
                  <select
                    value={orchForm.reportId}
                    onChange={handleOrchChange("reportId")}
                  >
                    <option value="">Selecciona un reporte</option>
                    {reports.map((report) => (
                      <option key={report.id} value={report.id}>
                        {report.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Correos destino</label>
                  <input
                    type="text"
                    placeholder="correo1@dominio.com, correo2@dominio.com"
                    value={orchForm.destinations}
                    onChange={handleOrchChange("destinations")}
                  />
                </div>
                <div className="field">
                  <label>Cron</label>
                  <input
                    type="text"
                    placeholder="0 9 * * 1-5"
                    value={orchForm.cron}
                    onChange={handleOrchChange("cron")}
                  />
                  <p className="muted">
                    Ejemplo: 0 9 * * 1-5 (Lun-Vie 9:00).
                  </p>
                </div>
                <div className="field">
                  <label>Zona horaria</label>
                  <input
                    type="text"
                    placeholder="America/Lima"
                    value={orchForm.timezone}
                    onChange={handleOrchChange("timezone")}
                  />
                </div>
                <button type="button" onClick={handleCreateOrchestration}>
                  Guardar programacion
                </button>
                {orchError ? <p className="error">{orchError}</p> : null}
              </div>

              <div className="orchestrator-table">
                <div className="table-head">
                  <span>Nombre</span>
                  <span>Reporte</span>
                  <span>Destinos</span>
                  <span>Cron</span>
                  <span>Estado</span>
                  <span>Acciones</span>
                </div>
                {orchestrations.length ? (
                  <div className="table-body">
                    {orchestrations.map((item) => (
                      <div key={item.id} className="table-row">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            handleFieldChange(
                              item.id,
                              "name",
                              event.target.value
                            )
                          }
                          onBlur={() => handleDetailsBlur(item)}
                          placeholder="Nombre"
                        />
                        <span>{item.report_name}</span>
                        <input
                          type="text"
                          value={item.destinations}
                          onChange={(event) =>
                            handleDestinationsChange(
                              item.id,
                              event.target.value
                            )
                          }
                          onBlur={(event) =>
                            handleDestinationsBlur(
                              item.id,
                              event.target.value
                            )
                          }
                          placeholder="correo1@dominio.com, correo2@dominio.com"
                        />
                        <input
                          type="text"
                          value={item.cron}
                          onChange={(event) =>
                            handleFieldChange(
                              item.id,
                              "cron",
                              event.target.value
                            )
                          }
                          onBlur={() => handleDetailsBlur(item)}
                          placeholder="0 9 * * 1-5"
                        />
                        <span
                          className={
                            item.status === "activo"
                              ? "status-chip active"
                              : "status-chip paused"
                          }
                        >
                          {item.status}
                        </span>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="ghost small"
                            onClick={() => handleToggleStatus(item)}
                          >
                            {item.status === "activo" ? "Pausar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            className="ghost small danger"
                            onClick={() => handleDeleteOrchestration(item)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-empty muted">
                    Aun no hay orquestaciones creadas.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      ) : (
        <main className="dashboard-body single">
          <section className="viewer">
            <div className="panel-header">
              <h2>Historial</h2>
            </div>
            <div className="history-list">
              <div className="history-head">
                <span>Fecha</span>
                <span>Usuario</span>
                <span>Accion</span>
              </div>
              {history.length ? (
                <div className="history-body">
                  {history.map((item) => (
                    <div key={item.id} className="history-row">
                      <span>{new Date(item.occurred_at).toLocaleString()}</span>
                      <span>{item.user_email}</span>
                      <span>Login</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="history-empty muted">
                  Aun no hay registros.
                </div>
              )}
              {historyError ? <p className="error">{historyError}</p> : null}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
