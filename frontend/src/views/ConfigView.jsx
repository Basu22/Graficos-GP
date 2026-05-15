import { useState, useEffect } from "react";
import { API, THEMES } from "../constants";

export function ConfigView({ T }) {
  const theme = T || THEMES.light;
  const { card, cardBorder: border, text, textMuted: muted, bg, input } = theme;

  const [roles, setRoles] = useState([]);
  const [tribus, setTribus] = useState([]);
  const [celulas, setCelulas] = useState([]);
  const [eventTypes, setEventTypes] = useState({});
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("categories"); // "categories" | "roles" | "tribus" | "celulas" | "tools"
  
  // States para Roles
  const [newRole, setNewRole] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingValue, setEditingValue] = useState("");

  // States para Tribus
  const [newTribu, setNewTribu] = useState("");
  const [editingTribuIdx, setEditingTribuIdx] = useState(null);
  const [editingTribuValue, setEditingTribuValue] = useState("");

  // States para Celulas
  const [newCelula, setNewCelula] = useState({ name: "", tribu: "" });
  const [editingCelulaIdx, setEditingCelulaIdx] = useState(null);
  const [editingCelulaValue, setEditingCelulaValue] = useState("");

  // States para Categorías
  const [newType, setNewType] = useState({ key: "", label: "", icon: "📌", color: "#64748B" });
  const [editingTypeKey, setEditingTypeKey] = useState(null);
  const [editingTypeValue, setEditingTypeValue] = useState(null);

  // States para Herramientas (Tools)
  const [newTool, setNewTool] = useState({ name: "", url: "" });
  const [editingToolIdx, setEditingToolIdx] = useState(null);
  const [editingToolValue, setEditingToolValue] = useState({ name: "", url: "" });
 
  const cardStyle = { background: card, borderRadius: 16, padding: "32px", border: `1px solid ${border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" };
  const inp = { padding: "10px 14px", borderRadius: 10, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 13, outline: "none", transition: "0.2s" };
 
  useEffect(() => {
    loadData();
  }, []);
 
  async function loadData() {
    setLoading(true);
    try {
      const [rData, tData, trData, cData, tlData] = await Promise.all([
        fetch(`${API}/config/roles`).then(r => r.json()),
        fetch(`${API}/config/event-types`).then(r => r.json()),
        fetch(`${API}/config/tribus`).then(r => r.json()),
        fetch(`${API}/config/celulas`).then(r => r.json()),
        fetch(`${API}/config/tools`).then(r => r.json())
      ]);
      setRoles(Array.isArray(rData) ? rData : []);
      setEventTypes(tData || {});
      setTribus(Array.isArray(trData) ? trData : []);
      setCelulas(Array.isArray(cData) ? cData : []);
      setTools(Array.isArray(tlData) ? tlData : []);
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

  async function saveTribus(updatedTribus) {
    try {
      await fetch(`${API}/config/tribus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tribus: updatedTribus })
      });
      setTribus(updatedTribus);
    } catch (e) { console.error(e); }
  }

  async function saveCelulas(updatedCelulas) {
    try {
      await fetch(`${API}/config/celulas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celulas: updatedCelulas })
      });
      setCelulas(updatedCelulas);
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

  async function saveTools(updatedTools) {
    try {
      await fetch(`${API}/config/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updatedTools })
      });
      setTools(updatedTools);
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

  function addTribu() {
    if (!newTribu.trim() || tribus.includes(newTribu.trim())) return;
    const next = [...tribus, newTribu.trim()];
    saveTribus(next);
    setNewTribu("");
  }
  function deleteTribu(tribu) {
    if (!confirm(`¿Eliminar la tribu "${tribu}"?`)) return;
    saveTribus(tribus.filter(t => t !== tribu));
  }
  function commitEditTribu() {
    if (!editingTribuValue.trim()) return;
    const next = [...tribus];
    next[editingTribuIdx] = editingTribuValue.trim();
    saveTribus(next);
    setEditingTribuIdx(null);
  }

  function addCelula() {
    if (!newCelula.name?.trim() || !newCelula.tribu) {
      alert("Debes escribir el nombre y seleccionar una Tribu.");
      return;
    }
    const next = [...celulas, { name: newCelula.name.trim(), tribu: newCelula.tribu }];
    saveCelulas(next);
    setNewCelula({ name: "", tribu: "" });
  }
  function deleteCelula(celula) {
    const name = typeof celula === 'string' ? celula : celula.name;
    if (!confirm(`¿Eliminar la célula "${name}"?`)) return;
    saveCelulas(celulas.filter(c => c !== celula));
  }
  function commitEditCelula() {
    setEditingCelulaIdx(null); // Desactivamos la edición para evitar corromper los objetos
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

  function addTool() {
    if (!newTool.name.trim() || !newTool.url.trim()) return;
    const next = [...tools, { name: newTool.name.trim(), url: newTool.url.trim() }];
    saveTools(next);
    setNewTool({ name: "", url: "" });
  }

  function deleteTool(idx) {
    if (!confirm(`¿Eliminar la herramienta "${tools[idx].name}"?`)) return;
    const next = tools.filter((_, i) => i !== idx);
    saveTools(next);
  }

  function startEditTool(idx) {
    setEditingToolIdx(idx);
    setEditingToolValue({ ...tools[idx] });
  }

  function commitEditTool() {
    if (!editingToolValue.name.trim() || !editingToolValue.url.trim()) return;
    const next = [...tools];
    next[editingToolIdx] = editingToolValue;
    saveTools(next);
    setEditingToolIdx(null);
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
        <button style={menuStyle(activeTab === "tribus")} onClick={() => setActiveTab("tribus")}>
          <span style={{ fontSize: 18 }}>⛺</span> Tribus
        </button>
        <button style={menuStyle(activeTab === "celulas")} onClick={() => setActiveTab("celulas")}>
          <span style={{ fontSize: 18 }}>🦠</span> Células
        </button>
        <button style={menuStyle(activeTab === "tools")} onClick={() => setActiveTab("tools")}>
          <span style={{ fontSize: 18 }}>🔗</span> Herramientas
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

        {activeTab === "tribus" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#10B98115", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⛺</div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Tribus</h3>
                <p style={{ fontSize: 12, color: muted, margin: 0 }}>Agrupaciones mayores de la organización</p>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 32 }}>
              {tribus.map((tribu, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                  {editingTribuIdx === idx ? (
                    <>
                      <input value={editingTribuValue} onChange={(e) => setEditingTribuValue(e.target.value)} style={{ ...inp, flex: 1, padding: "4px 8px" }} autoFocus onKeyDown={(e) => e.key === 'Enter' && commitEditTribu()} />
                      <button onClick={commitEditTribu} style={{ background: "none", border: "none", cursor: "pointer" }}>✅</button>
                      <button onClick={() => setEditingTribuIdx(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: text }}>{tribu}</span>
                      <button onClick={() => {setEditingTribuIdx(idx); setEditingTribuValue(tribu)}} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>✏️</button>
                      <button onClick={() => deleteTribu(tribu)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>🗑️</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderRadius: 16, background: bg, border: `2px dashed ${border}`, display: "flex", gap: 12 }}>
              <input value={newTribu} onChange={(e) => setNewTribu(e.target.value)} placeholder="Nueva Tribu (ej: Oferta Minorista)..." style={{ ...inp, flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && addTribu()} />
              <button onClick={addTribu} style={{ padding: "0 28px", borderRadius: 10, border: "none", background: "#10B981", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>+ Agregar</button>
            </div>
          </div>
        )}

        {activeTab === "celulas" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#F59E0B15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🦠</div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Células</h3>
                <p style={{ fontSize: 12, color: muted, margin: 0 }}>Equipos específicos que pertenecen a una Tribu</p>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 32 }}>
              {celulas.map((celula, idx) => {
                const cName = typeof celula === 'string' ? celula : celula.name;
                const cTribu = typeof celula === 'string' ? "Sin Tribu" : celula.tribu;

                return (
                   <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: bg, border: `1px solid ${border}` }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: text }}>{cName}</span>
                      <span style={{ fontSize: 10, color: muted, fontWeight: 600 }}>⛺ {cTribu}</span>
                    </div>
                    <button onClick={() => deleteCelula(celula)} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>🗑️</button>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: 24, borderRadius: 16, background: bg, border: `2px dashed ${border}`, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <select value={newCelula.tribu || ""} onChange={(e) => setNewCelula({...newCelula, tribu: e.target.value})} style={{ ...inp, width: 220 }}>
                <option value="">Seleccionar Tribu...</option>
                {tribus.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newCelula.name || ""} onChange={(e) => setNewCelula({...newCelula, name: e.target.value})} placeholder="Nueva Célula (ej: Equipo Datos)..." style={{ ...inp, flex: 1, minWidth: 200 }} onKeyDown={(e) => e.key === 'Enter' && addCelula()} />
              <button onClick={addCelula} style={{ padding: "0 28px", borderRadius: 10, border: "none", background: "#F59E0B", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>+ Agregar</button>
            </div>
          </div>
        )}

        {activeTab === "tools" && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#3B82F615", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔗</div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Herramientas del Centro de Comando</h3>
                <p style={{ fontSize: 12, color: muted, margin: 0 }}>Gestioná los enlaces rápidos de la vista Mi Día</p>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginBottom: 32 }}>
              {tools.map((tool, idx) => (
                <div key={idx} style={{ padding: "16px", borderRadius: 16, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 14 }}>
                  {editingToolIdx === idx ? (
                    <div style={{ display: "flex", gap: 12, width: "100%", alignItems: "center" }}>
                      <input value={editingToolValue.name} onChange={e => setEditingToolValue({...editingToolValue, name: e.target.value})} style={{ ...inp, width: 150 }} placeholder="Nombre" />
                      <input value={editingToolValue.url} onChange={e => setEditingToolValue({...editingToolValue, url: e.target.value})} style={{ ...inp, flex: 1 }} placeholder="https://..." />
                      <button onClick={commitEditTool} style={{ background: "#3B82F6", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                      <button onClick={() => setEditingToolIdx(null)} style={{ background: "transparent", color: muted, border: `1px solid ${border}`, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#3B82F610", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                        {tool.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: text }}>{tool.name}</div>
                        <div style={{ fontSize: 11, color: muted, opacity: 0.7, wordBreak: "break-all" }}>{tool.url}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEditTool(idx)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✏️</button>
                        <button onClick={() => deleteTool(idx)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderRadius: 16, background: bg, border: `2px dashed ${border}` }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: text, marginBottom: 16 }}>➕ Añadir Nueva Herramienta</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <input value={newTool.name} onChange={e => setNewTool({...newTool, name: e.target.value})} placeholder="Nombre (ej: Jira)" style={{ ...inp, width: 180 }} />
                <input value={newTool.url} onChange={e => setNewTool({...newTool, url: e.target.value})} placeholder="https://..." style={{ ...inp, flex: 1, minWidth: 250 }} />
                <button onClick={addTool} style={{ padding: "0 28px", borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Agregar Herramienta</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
