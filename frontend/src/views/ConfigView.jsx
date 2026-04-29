import { useState, useEffect } from "react";
import { API, THEMES } from "../constants";

export function ConfigView({ T }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, bg, input } = theme;

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  const cardStyle = { background: card, borderRadius: 12, padding: "24px", border: `1px solid ${border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" };
  const inp = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 13, outline: "none" };

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    setLoading(true);
    try {
      const data = await fetch(`${API}/config/roles`).then(r => r.json());
      setRoles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function saveRoles(updatedRoles) {
    try {
      await fetch(`${API}/config/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: updatedRoles })
      });
      setRoles(updatedRoles);
    } catch (e) {
      console.error(e);
    }
  }

  function addRole() {
    if (!newRole.trim()) return;
    if (roles.includes(newRole.trim())) return;
    const next = [...roles, newRole.trim()];
    saveRoles(next);
    setNewRole("");
  }

  function deleteRole(role) {
    if (!confirm(`¿Eliminar el rol "${role}"?`)) return;
    const next = roles.filter(r => r !== role);
    saveRoles(next);
  }

  function startEdit(idx, val) {
    setEditingIdx(idx);
    setEditingValue(val);
  }

  function commitEdit() {
    if (!editingValue.trim()) return;
    const next = [...roles];
    next[editingIdx] = editingValue.trim();
    saveRoles(next);
    setEditingIdx(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: text, margin: 0 }}>⚙️ Configuración</h2>
        <p style={{ fontSize: 14, color: muted, marginTop: 4 }}>Gestioná los datos maestros del sistema.</p>
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 20 }}>🎭</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: text, margin: 0 }}>Roles de Personas</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: muted }}>Cargando roles...</div>
          ) : (
            roles.map((role, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
                {editingIdx === idx ? (
                  <>
                    <input 
                      value={editingValue} 
                      onChange={(e) => setEditingValue(e.target.value)} 
                      style={{ ...inp, flex: 1, padding: "4px 8px" }} 
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                    />
                    <button onClick={commitEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✅</button>
                    <button onClick={() => setEditingIdx(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: text }}>{role}</span>
                    <button onClick={() => startEdit(idx, role)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>✏️</button>
                    <button onClick={() => deleteRole(role)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>🗑️</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${border}` }}>
          <input 
            value={newRole} 
            onChange={(e) => setNewRole(e.target.value)} 
            placeholder="Nuevo rol (ej: Scrum Master)" 
            style={{ ...inp, flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && addRole()}
          />
          <button 
            onClick={addRole}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3B82F6", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            + Agregar Rol
          </button>
        </div>
      </div>
    </div>
  );
}
