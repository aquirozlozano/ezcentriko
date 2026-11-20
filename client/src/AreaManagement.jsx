import { useEffect, useState } from 'react';
import { getAreas, createArea, renameArea, saveAreaReports, assignUserArea, getAdminUsers, getAdminReports } from './api.js';

export default function AreaManagement({ token }) {
  const [areas, setAreas] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [editName, setEditName] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [a, u, r] = await Promise.all([getAreas(token), getAdminUsers(token), getAdminReports(token)]);
    setAreas(a.areas); setUsers(u.users); setReports(r.reports);
    setAssignments(Object.fromEntries(u.users.map(user => [user.id, user.area_id ?? ''])));
  }
  useEffect(() => {
    let cancelled = false;
    Promise.all([getAreas(token), getAdminUsers(token), getAdminReports(token)])
      .then(([a, u, r]) => {
        if (cancelled) return;
        setAreas(a.areas); setUsers(u.users); setReports(r.reports);
        setAssignments(Object.fromEntries(u.users.map(user => [user.id, user.area_id ?? ''])));
      }).catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);
  useEffect(() => {
    const area = areas.find(a => String(a.id) === selected);
    setEditName(area?.name || ''); setPermissions(area?.report_ids || []);
  }, [selected, areas]);

  async function perform(action, success) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); setMessage(success); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Cargando áreas y usuarios…</p>;
  return <>
    <div className="panel-header"><h2>Áreas y accesos</h2></div>
    <p className="muted">Cada usuario pertenece a un área y accede a sus reportes. Los administradores pueden consultar todos los reportes de su empresa.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success-message" role="status">{message}</p>}
    <fieldset disabled={busy} className="area-controls">
      <div className="manage-grid">
        <section className="manage-panel">
          <h3>Áreas de la empresa</h3>
          <form className="form" onSubmit={e => {
            e.preventDefault();
            perform(async () => {
              const result = await createArea(token, name.trim());
              setName(''); setSelected(String(result.area.id));
            }, 'Área creada. Asigna sus reportes y usuarios.');
          }}>
            <label htmlFor="new-area">Nombre del área</label>
            <input id="new-area" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Finanzas" />
            <button type="submit">Crear área</button>
          </form>
          <div className="manage-list">
            {areas.map(area => <button key={area.id} type="button"
              className={String(area.id) === selected ? 'report-item active' : 'report-item'}
              aria-pressed={String(area.id) === selected} onClick={() => { setSelected(String(area.id)); setMessage(''); }}>
              <span className="report-icon" aria-hidden="true">{area.name.slice(0, 1)}</span>
              <span className="report-text"><span className="report-title">{area.name}</span>
                <span className="report-meta">{area.user_count} usuarios · {area.report_ids.length} reportes</span></span>
            </button>)}
            {!areas.length && <p className="muted">Crea la primera área para organizar los accesos.</p>}
          </div>
        </section>
        <section className="manage-panel">
          <h3>Reportes del área</h3>
          {!selected ? <p className="muted">Selecciona un área para configurar sus reportes.</p> : <>
            <form className="form" onSubmit={e => { e.preventDefault(); perform(() => renameArea(token, selected, editName.trim()), 'Nombre actualizado.'); }}>
              <label htmlFor="area-name">Nombre</label>
              <input id="area-name" required maxLength={100} value={editName} onChange={e => setEditName(e.target.value)} />
              <button type="submit" className="ghost">Guardar nombre</button>
            </form>
            <p className="muted">Estos permisos se aplican a todos los usuarios del área.</p>
            <div className="permissions-list">
              {reports.map(report => <label key={report.id} className="permission-item">
                <input type="checkbox" checked={permissions.includes(report.id)} onChange={() => setPermissions(previous => previous.includes(report.id) ? previous.filter(id => id !== report.id) : [...previous, report.id])} />
                <span>{report.name}</span>
              </label>)}
              {!reports.length && <p className="muted">No hay reportes disponibles en esta empresa.</p>}
            </div>
            <button type="button" onClick={() => perform(() => saveAreaReports(token, selected, permissions), 'Permisos del área guardados.')}>Guardar reportes del área</button>
          </>}
        </section>
      </div>
      <section className="manage-panel area-users">
        <h3>Asignar usuarios a áreas</h3>
        <p className="muted">Un usuario sin área no tendrá acceso a reportes, salvo que sea administrador.</p>
        {users.map(user => <div className="area-user-row" key={user.id}>
          <div><strong>{user.name}</strong><p className="muted">{user.email} · {user.role}</p></div>
          <div className="field">
            <label htmlFor={`user-area-${user.id}`}>Área de {user.name}</label>
            <select id={`user-area-${user.id}`} value={assignments[user.id] ?? ''} onChange={e => setAssignments(previous => ({ ...previous, [user.id]: e.target.value }))}>
              <option value="">Sin área</option>
              {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
            </select>
          </div>
          <button type="button" disabled={String(assignments[user.id] ?? '') === String(user.area_id ?? '')}
            onClick={() => perform(() => assignUserArea(token, user.id, assignments[user.id] === '' ? null : Number(assignments[user.id])), `Área de ${user.name} actualizada.`)}>Guardar asignación</button>
        </div>)}
        {!users.length && <p className="muted">No hay usuarios.</p>}
      </section>
      {busy && <p role="status">Guardando cambios…</p>}
    </fieldset>
  </>;
}
