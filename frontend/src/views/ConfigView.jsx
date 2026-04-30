import { useState, useEffect } from "react";
import { API, THEMES } from "../constants";

export function ConfigView({ T }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, bg, input } = theme;

  const [roles, setRoles] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("categories"); // "categories" | "roles"
  
  // States para Roles
  const [newRole, setNewRole] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  // States para Categorías
  const [newType, setNewType] = useState({ key: "", label: "", icon: "📌", color: "#64748B" });
  const [editingTypeKey, setEditingTypeKey] = useState(null);
  const [editingTypeValue, setEditingTypeValue] = useState(null);
 
  const cardStyle = { background: card, borderRadius: 16, padding: "32px", border: `1px solid ${border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" };
  const inp = { padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 13, outline: "none", transition: "0.2s" };
 
  useEffect(() => {
    loadData();
  }, []);
 
  async function loadData() {
    setLoading(true);
    try {
      const [rData, tData] = await Promise.all([
        fetch(`${API}/config/roles`).then(r => r.json()),
        fetch(`${API}/config/event-types`).then(r => r.json())
      ]);
      setRoles(Array.isArray(rData) ? rData : []);
      setEventTypes(tData || {});
    } catch (e) { console.error(e); }
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
    } catch (e) { console.error(e); }
  }

  async function saveEventTypes(updatedTypes) {
    try {
      await fetch(`${API}/config/event-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_types: updatedTypes })
      });
      setEventTypes(updatedTypes);
    } catch (e) { console.error(e); }
  }
 
  function addRole() {
    if (!newRole.trim() || roles.includes(newRole.trim())) return;
    const next = [...roles, newRole.trim()];
    saveRoles(next);
    setNewRole("");
  }
  function deleteRole(role) {
    if (!confirm(`¿Eliminar el rol "${role}"?`)) return;
    saveRoles(roles.filter(r => r !== role));
  }
  function commitEditRole() {
    if (!editingValue.trim()) return;
    const next = [...roles];
    next[editingIdx] = editingValue.trim();
    saveRoles(next);
    setEditingIdx(null);
  }

  function addEventType() {
    if (!newType.key.trim() || !newType.label.trim()) return;
    const key = newType.key.trim().toLowerCase().replace(/\s+/g, "_");
    if (eventTypes[key]) { alert("La clave ya existe"); return; }
    const next = { ...eventTypes, [key]: { label: newType.label, icon: newType.icon, color: newType.color } };
    saveEventTypes(next);
    setNewType({ key: "", label: "", icon: "📌", color: "#64748B" });
  }

  function deleteEventType(key) {
    if (["sprint", "manual_sprint", "holiday"].includes(key)) {
      alert("Esta es una categoría del sistema y no puede eliminarse");
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${eventTypes[key].label}"?`)) return;
    const next = { ...eventTypes };
    delete next[key];
    saveEventTypes(next);
  }

  function startEditType(key, val) {
    setEditingTypeKey(key);
    setEditingTypeValue({ ...val });
  }

  function commitEditType() {
    const next = { ...eventTypes, [editingTypeKey]: editingTypeValue };
    saveEventTypes(next);
    setEditingTypeKey(null);
  }

  const menuStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderRadius: 12,
    background: active ? "#3B82F615" : "transparent",
    color: active ? "#3B82F6" : muted,
    fontWeight: active ? 800 : 600,
    fontSize: 14, border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "0.2s"
  });
 
  return (
    <div style={{ display: "flex", gap: 40, minHeight: "70vh" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: text, margin: 0 }}>⚙️ Config</h2>
          <p style={{ fontSize: 12, color: muted, marginTop: 4 }}>Administración del Agility Dashboard</p>
        </div>
        
        <button style={menuStyle(activeTab === "categories")} onClick={() => setActiveTab("categories")}>
          <span style={{ fontSize: 18 }}>🏷️</span> Categorías
        </button>
        <button style={menuStyle(activeTab === "roles")} onClick={() => setActiveTab("roles")}>
          <span style={{ fontSize: 18 }}>🎭</span> Roles
        </button>
        
        <div style={{ marginTop: "auto", padding: 20, borderRadius: 16, background: bg, border: `1px dashed ${border}`, fontSize: 11, color: muted, fontStyle: "italic" }}>
          Versión del Motor: 2.1.0<br/>
          Estado: Conectado
        </div>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1 }}>
        
        {activeTab === "categories" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#3B82F615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🏷️</div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Categorías de Calendario</h3>
                  <p style={{ fontSize: 12, color: muted, margin: 0 }}>Gestioná los tipos de eventos y licencias</p>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 32 }}>
              {Object.entries(eventTypes).map(([key, val]) => (
                <div key={key} style={{ padding: "16px", borderRadius: 16, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                  {editingTypeKey === key ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={editingTypeValue.icon} onChange={e => setEditingTypeValue({...editingTypeValue, icon: e.target.value})} style={{ ...inp, width: 45, textAlign: "center" }} />
                        <input value={editingTypeValue.label} onChange={e => setEditingTypeValue({...editingTypeValue, label: e.target.value})} style={{ ...inp, flex: 1 }} />
                        <input type="color" value={editingTypeValue.color} onChange={e => setEditingTypeValue({...editingTypeValue, color: e.target.value})} style={{ width: 34, height: 34, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={commitEditType} style={{ background: "#3B82F6", color: "#fff", border: "none", padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                        <button onClick={() => setEditingTypeKey(null)} style={{ background: "transparent", color: muted, border: `1px solid ${border}`, padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: val.color + "15", color: val.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                        {val.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: text }}>{val.label}</div>
                        <div style={{ fontSize: 10, color: muted, fontStyle: "italic", opacity: 0.7 }}>ID: {key}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => startEditType(key, val)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✏️</button>
                        {!["sprint", "manual_sprint", "holiday"].includes(key) && (
                          <button onClick={() => deleteEventType(key)} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>🗑️</button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderRadius: 16, background: bg, border: `2px dashed ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: text, marginBottom: 16 }}>➕ Añadir Nueva Categoría</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <input value={newType.icon} onChange={e => setNewType({...newType, icon: e.target.value})} placeholder="😊" style={{ ...inp, width: 55, textAlign: "center", fontSize: 18 }} />
                <input value={newType.label} onChange={e => setNewType({...newType, label: e.target.value})} placeholder="Nombre (ej: Capacitación)" style={{ ...inp, flex: 1, minWidth: 200 }} />
                <input value={newType.key} onChange={e => setNewType({...newType, key: e.target.value})} placeholder="ID único (ej: capac)" style={{ ...inp, width: 140 }} />
                <input type="color" value={newType.color} onChange={e => setNewType({...newType, color: e.target.value})} style={{ width: 42, height: 42, padding: 0, border: `1px solid ${border}`, borderRadius: 10, cursor: "pointer" }} />
                <button onClick={addEventType} style={{ padding: "0 28px", borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Crear Categoría</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "roles" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8B5CF615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🎭</div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Roles de Personas</h3>
                <p style={{ fontSize: 12, color: muted, margin: 0 }}>Define las especialidades del equipo</p>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 32 }}>
              {roles.map((role, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                  {editingIdx === idx ? (
                    <>
                      <input value={editingValue} onChange={(e) => setEditingValue(e.target.value)} style={{ ...inp, flex: 1, padding: "4px 8px" }} autoFocus onKeyDown={(e) => e.key === 'Enter' && commitEditRole()} />
                      <button onClick={commitEditRole} style={{ background: "none", border: "none", cursor: "pointer" }}>✅</button>
                      <button onClick={() => setEditingIdx(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: text }}>{role}</span>
                      <button onClick={() => {setEditingIdx(idx); setEditingValue(role)}} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>✏️</button>
                      <button onClick={() => deleteRole(role)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderRadius: 16, background: bg, border: `2px dashed ${border}`, display: "flex", gap: 12 }}>
              <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Nuevo rol (ej: Cloud Architect)..." style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addRole()} />
              <button onClick={addRole} style={{ padding: "0 28px", borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>+ Agregar</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
