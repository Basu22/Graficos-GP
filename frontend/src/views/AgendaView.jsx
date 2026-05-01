import { useState, useEffect } from "react";
import { API, THEMES } from "../constants";

export function AgendaView({ T }) {
  const { card, cardBorder: border, text, textMuted: muted, bg, input } = T;

  const [contacts, setContacts] = useState([]);
  const [tribus, setTribus] = useState([]);
  const [celulas, setCelulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  const cardStyle = { background: card, borderRadius: 16, padding: "24px", border: `1px solid ${border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" };
  const inp = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${border}`, background: input || bg, color: text, fontSize: 13, outline: "none", transition: "0.2s" };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cData, trData, ceData] = await Promise.all([
        fetch(`${API}/agenda`).then(r => r.json()),
        fetch(`${API}/config/tribus`).then(r => r.json()),
        fetch(`${API}/config/celulas`).then(r => r.json())
      ]);
      setContacts(Array.isArray(cData) ? cData : []);
      setTribus(Array.isArray(trData) ? trData : []);
      setCelulas(Array.isArray(ceData) ? ceData : []);
    } catch (e) {
      console.error("Error cargando agenda:", e);
    }
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`${API}/agenda/sync-jira`, { method: "POST" });
      const data = await res.json();
      if (data.status === "ok") {
        alert(`Sincronización exitosa.\nNuevos: ${data.changes.added}\nActualizados: ${data.changes.updated}`);
        await loadData();
      } else {
        alert("Ocurrió un error o el método aún no está implementado al 100%.");
      }
    } catch (e) {
      console.error("Error sincronizando:", e);
      alert("Error de conexión al sincronizar.");
    }
    setSyncing(false);
  }

  async function updateContactAttr(id, field, value) {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;
    
    const updated = { ...contact, [field]: value };
    
    // Actualización optimista en la UI
    setContacts(contacts.map(c => c.id === id ? updated : c));

    try {
      await fetch(`${API}/agenda/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error("Error actualizando contacto:", e);
      // Revertir en caso de error
      setContacts(contacts.map(c => c.id === id ? contact : c));
    }
  }

  const filteredContacts = contacts.filter(c => 
    (c.nombre + " " + c.apellido + " " + c.email + " " + c.jira_account_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* HEADER SECTION */}
      <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>📇 Directorio Organizacional</h2>
          <p style={{ fontSize: 12, color: muted, margin: 0 }}>Base de datos unificada de colaboradores</p>
        </div>
        
        <div style={{ display: "flex", gap: 12 }}>
          <input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="🔍 Buscar persona..." 
            style={{ ...inp, width: 250 }} 
          />
          <button 
            onClick={handleSync} 
            disabled={syncing}
            style={{ 
              padding: "8px 16px", borderRadius: 8, border: "none", 
              background: syncing ? "#94A3B8" : "#3B82F6", color: "#fff", 
              fontSize: 13, fontWeight: 700, cursor: syncing ? "default" : "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}
          >
            {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar con Jira"}
          </button>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div style={{ ...cardStyle, overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: muted }}>Cargando directorio...</div>
        ) : filteredContacts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: muted }}>
            No hay contactos. ¡Presioná "Sincronizar con Jira" para llenar la agenda!
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${border}`, color: muted }}>
                <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700 }}>Colaborador</th>
                <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700 }}>Usuario Jira</th>
                <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700 }}>Email</th>
                <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700 }}>Tribu</th>
                <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700 }}>Célula</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: "12px 8px", fontWeight: 600, color: text }}>
                    {c.nombre} {c.apellido}
                  </td>
                  <td style={{ padding: "12px 8px", color: muted }}>
                    <div style={{ background: bg, padding: "4px 8px", borderRadius: 6, display: "inline-block", fontSize: 11 }}>
                      {c.jira_account_id}
                    </div>
                  </td>
                  <td style={{ padding: "12px 8px", color: text }}>{c.email}</td>
                  
                  {/* Select Tribu */}
                  <td style={{ padding: "12px 8px" }}>
                    <select 
                      value={c.tribu || ""} 
                      onChange={(e) => updateContactAttr(c.id, "tribu", e.target.value)}
                      style={{ ...inp, width: "100%", padding: "6px" }}
                    >
                      <option value="">-- Sin Tribu --</option>
                      {tribus.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  
                  {/* Select Múltiple Célula (Chips) */}
                  <td style={{ padding: "12px 8px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {celulas
                        .filter(ce => {
                          if (typeof ce === 'string') return true; // Mostramos células antiguas por compatibilidad
                          if (!c.tribu) return false; // Si no hay tribu seleccionada, ocultamos
                          return ce.tribu === c.tribu;
                        })
                        .map(ce => {
                        const ceName = typeof ce === 'string' ? ce : ce.name;
                        const isSelected = (c.celulas || []).includes(ceName);
                        // Fallback de migración por si quedó 'celula' vieja (string)
                        const isLegacySelected = typeof c.celula === 'string' && c.celula === ceName;
                        const active = isSelected || isLegacySelected;
                        
                        return (
                          <div 
                            key={ceName} 
                            onClick={() => {
                              let next = [...(c.celulas || [])];
                              if (isLegacySelected && !next.includes(ceName)) next.push(ceName);
                              if (active) {
                                next = next.filter(x => x !== ceName);
                              } else {
                                next.push(ceName);
                              }
                              updateContactAttr(c.id, "celulas", next);
                            }}
                            style={{ 
                              fontSize: 11, padding: "3px 8px", borderRadius: 8, cursor: "pointer",
                              background: active ? "#F59E0B" : bg,
                              color: active ? "#fff" : muted,
                              border: `1px solid ${active ? "#F59E0B" : border}`,
                              transition: "all 0.2s",
                              fontWeight: active ? 700 : 500
                            }}
                          >
                            {active ? "✓ " : ""}{ceName}
                          </div>
                        );
                      })}
                      {!c.tribu && <span style={{fontSize:11, color: muted, fontStyle: "italic"}}>Selecciona Tribu primero</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
