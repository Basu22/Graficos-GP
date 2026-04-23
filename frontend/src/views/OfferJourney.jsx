import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine, ReferenceDot, Brush
} from 'recharts';
import { prepareTimelineData, PRODUCT_LABELS, BANK_COLORS, getAvailableMonths, aggregateByMonth, calcMonthlyDeltas } from '../utils/offerJourney';
import { API } from '../constants';

const CustomTooltip = ({ active, payload, label, productLabels, fullData }) => {
  if (active && payload && payload.length) {
    // Buscar el día anterior para calcular variaciones en el tooltip
    const currentIndex = fullData?.findIndex(d => d.date === label);
    const prevDay = currentIndex > 0 ? fullData[currentIndex - 1] : null;

    return (
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid #334155', 
        padding: '12px', 
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        maxWidth: '350px'
      }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '8px' }}>{label}</p>
        <p style={{ margin: 0, fontSize: '10px', fontWeight: 600, color: '#CBD5E1', marginBottom: '8px' }}>
          {productLabels.join(' + ')}
        </p>
        
        {payload[0]?.payload?.daily_analysis && (
          <div style={{ 
            background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px', padding: '8px', marginBottom: '12px', fontSize: '11px',
            color: '#93C5FD', lineHeight: '1.4', wordBreak: 'break-word'
          }}>
            <div style={{ fontWeight: 800, fontSize: '9px', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📧</span> Análisis Global del Día
            </div>
            {payload[0].payload.daily_analysis}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {payload.map((entry, index) => {
            const bank = entry.dataKey;
            const value = entry.value;
            const prevValue = prevDay ? prevDay[bank] : null;
            
            let delta = null;
            if (prevValue && prevValue > 0) {
              delta = (((value - prevValue) / prevValue) * 100).toFixed(1);
            }

            const tipo = entry.payload ? entry.payload[`${bank}_tipo`] : null;
            const comment = entry.payload ? entry.payload[`${bank}_comment`] : null;
            const isReproceso = tipo === 'reproceso';
            
            return (
              <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: index < payload.length - 1 ? '1px solid #334155' : 'none', paddingBottom: index < payload.length - 1 ? '4px' : 0, marginBottom: index < payload.length - 1 ? '4px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#CBD5E1' }}>{bank}:</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {delta && (
                      <span style={{ fontSize: '9px', fontWeight: 800, color: Number(delta) > 0 ? '#10B981' : Number(delta) < 0 ? '#EF4444' : '#94A3B8', marginRight: '4px' }}>
                        {Number(delta) > 0 ? '↑ ' : Number(delta) < 0 ? '↓ ' : ''}{Math.abs(delta)}%
                      </span>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#F1F5F9' }}>
                      {typeof value === 'number' && value % 1 !== 0 
                        ? value.toFixed(2) + '%' 
                        : new Intl.NumberFormat('es-AR').format(value)}
                    </span>
                    {isReproceso && (
                      <span style={{ fontSize: '8px', background: 'rgba(139, 92, 246, 0.2)', color: '#A78BFA', padding: '1px 4px', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>R</span>
                    )}
                  </div>
                </div>
                {comment && (
                  <div style={{ 
                    fontSize: '10px', fontStyle: 'italic', color: '#94A3B8', padding: '6px', 
                    background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginTop: '4px',
                    lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'normal' 
                  }}>
                    💬 {comment}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

// Dropdown Multi-Select Hook & Component
function useOutsideClick(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}

const BACKEND = window.location.hostname === 'localhost'
  ? '/api/v1'
  : API;

export default function OfferJourney({ healthReport, T, onRefreshHealth }) {
  const [selectedProducts, setSelectedProducts] = useState(['haberes']);
  const [selectedBanks, setSelectedBanks] = useState(["BSF", "BER", "BSJ", "BSC"]);
  const [range, setRange] = useState('last_30'); // last_30, last_90, all
  const [viewMode, setViewMode] = useState('timeline'); // timeline, monthly_compare, delta
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [editingComment, setEditingComment] = useState(null); // { date, bank, comment }
  const [isSaving, setIsSaving] = useState(false);
  const [brushIndices, setBrushIndices] = useState({ start: null, end: null });
  
  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${months[parseInt(month) - 1]} ${year.slice(-2)}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${day} ${months[parseInt(month) - 1]} ${year.slice(-2)}`;
  };

  const dropdownRef = useRef(null);
  const modalRef = useRef(null);

  useOutsideClick(dropdownRef, () => setShowMonthDropdown(false));
  useOutsideClick(modalRef, () => setEditingComment(null));

  const availableMonths = useMemo(() => {
    if (!healthReport || !healthReport.allDays) return [];
    return getAvailableMonths(healthReport.allDays);
  }, [healthReport]);

  // Inicializar selectedMonths si está vacío
  useEffect(() => {
    if (selectedMonths.length === 0 && availableMonths.length > 0) {
      // Por defecto seleccionar los últimos 3 meses
      setSelectedMonths(availableMonths.slice(0, 3).map(m => m.id));
    }
  }, [availableMonths, selectedMonths.length]);

  const timelineData = useMemo(() => {
    if (!healthReport || !healthReport._rawDays) return [];
    let days = healthReport.allDays || [];
    if (range === 'last_30') days = days.slice(0, 30);
    else if (range === 'last_90') days = days.slice(0, 90);
    return prepareTimelineData(healthReport._rawDays, days, selectedProducts, selectedBanks);
  }, [healthReport, selectedProducts, selectedBanks, range]);

  // Al cambiar el filtro de rango, limpiamos los índices para que el Brush 
  // (que se remonta por su 'key') asuma el control total por defecto.
  useEffect(() => {
    setBrushIndices({ start: null, end: null });
  }, [range]);

  const rawMonthlyData = useMemo(() => {
    if (!healthReport || !healthReport._rawDays) return [];
    return aggregateByMonth(healthReport._rawDays, healthReport.allDays, selectedBanks, selectedProducts);
  }, [healthReport, selectedBanks, selectedProducts]);

  const monthlyCompareData = useMemo(() => {
    return rawMonthlyData.filter(d => selectedMonths.includes(d.month));
  }, [rawMonthlyData, selectedMonths]);

  const deltaData = useMemo(() => {
    const deltas = calcMonthlyDeltas(rawMonthlyData, selectedBanks);
    return deltas.filter(d => selectedMonths.includes(d.month));
  }, [rawMonthlyData, selectedBanks, selectedMonths]);

  if (!healthReport || healthReport.loading) return <div style={{ color: T.muted }}>Cargando datos históricos...</div>;

  const toggleBank = (bank) => {
    if (selectedBanks.includes(bank)) setSelectedBanks(selectedBanks.filter(b => b !== bank));
    else setSelectedBanks([...selectedBanks, bank]);
  };

  const toggleProduct = (prod) => {
    if (selectedProducts.includes(prod)) {
      if (selectedProducts.length > 1) setSelectedProducts(selectedProducts.filter(p => p !== prod));
    } else {
      setSelectedProducts([...selectedProducts, prod]);
    }
  };

  const toggleMonth = (monthId) => {
    if (selectedMonths.includes(monthId)) {
      if (selectedMonths.length > 1) setSelectedMonths(selectedMonths.filter(m => m !== monthId));
    } else {
      setSelectedMonths([...selectedMonths, monthId]);
    }
  };

  const handleChartClick = (e, forcedBank = null) => {
    if (viewMode !== 'timeline') return;
    if (e && e.activePayload && e.activePayload.length > 0) {
      const data = e.activePayload[0].payload;
      const date = data.date;
      
      // Buscar el día anterior en timelineData para calcular el delta
      const idx = timelineData.findIndex(d => d.date === date);
      const prevData = idx > 0 ? timelineData[idx - 1] : null;

      const getDelta = (bank) => {
        if (!prevData || !prevData[bank]) return null;
        const current = data[bank] || 0;
        const prev = prevData[bank];
        return (((current - prev) / prev) * 100).toFixed(1);
      };

      // Si se hizo clic en un globo específico (forcedBank)
      if (forcedBank && typeof forcedBank === 'string') {
        setEditingComment({
          date,
          bank: forcedBank,
          comment: data[`${forcedBank}_comment`] || "",
          _allData: e.activePayload,
          delta: getDelta(forcedBank)
        });
        return;
      }

      if (selectedBanks.length === 1) {
        const bank = selectedBanks[0];
        setEditingComment({ 
          date, 
          bank, 
          comment: data[`${bank}_comment`] || "",
          _allData: e.activePayload,
          delta: getDelta(bank),
          daily_analysis: data.daily_analysis || ""
        });
      } else {
        setEditingComment({ 
          date, 
          bank: null, 
          comment: "",
          _allData: e.activePayload.map(p => ({ ...p, delta: getDelta(p.dataKey) })),
          daily_analysis: data.daily_analysis || ""
        });
      }
    }
  };

  const saveComment = async () => {
    if (!editingComment.bank && !editingComment.isGlobal) return;
    setIsSaving(true);
    try {
      const endpoint = editingComment.isGlobal 
        ? `${BACKEND}/midia/health-report/global-analysis`
        : `${BACKEND}/midia/health-report/comment`;
      
      const body = editingComment.isGlobal
        ? { date: editingComment.date, analysis: editingComment.comment }
        : { date: editingComment.date, bank: editingComment.bank, comment: editingComment.comment };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        // En lugar de cerrar, volvemos a la lista para seguir editando
        // Actualizamos el comentario guardado localmente en el objeto del modal
        const updatedComment = editingComment.comment;
        const newEditing = { ...editingComment, bank: null, isGlobal: false };
        
        if (editingComment.isGlobal) {
          newEditing.daily_analysis = updatedComment;
        } else {
          // Actualizamos en el payload local para que la vista previa sea correcta
          newEditing._allData = newEditing._allData.map(p => 
            p.dataKey === editingComment.bank 
              ? { ...p, payload: { ...p.payload, [`${p.dataKey}_comment`]: updatedComment } }
              : p
          );
        }
        
        setEditingComment(newEditing);
        if (onRefreshHealth) onRefreshHealth();
      }
    } catch (e) {
      console.error("Error saving comment:", e);
    }
    setIsSaving(false);
  };

  const productLabelsList = selectedProducts.map(p => PRODUCT_LABELS[p]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      
      {/* PANEL DE CONTROLES */}
      <div style={{ 
        display: 'flex', flexWrap: 'wrap', gap: '20px', background: T.card, 
        padding: '20px', borderRadius: '16px', border: `1px solid ${T.border}`,
        alignItems: 'flex-start'
      }}>
        
        {/* Campañas (Productos) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Campañas</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '300px' }}>
            {Object.entries(PRODUCT_LABELS).map(([key, label]) => (
              <button 
                key={key} onClick={() => toggleProduct(key)}
                style={{ 
                  padding: '4px 8px', borderRadius: '6px', border: `1px solid ${selectedProducts.includes(key) ? '#3B82F6' : T.border}`,
                  background: selectedProducts.includes(key) ? '#3B82F620' : 'transparent',
                  color: selectedProducts.includes(key) ? '#3B82F6' : T.muted,
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {label.replace('Oferta Tarjeta – ', '').replace('Adelanto de ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Bancos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Bancos</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {["BSF", "BER", "BSJ", "BSC"].map(bank => (
              <button 
                key={bank} onClick={() => toggleBank(bank)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px', 
                  border: `1px solid ${selectedBanks.includes(bank) ? BANK_COLORS[bank] : T.border}`,
                  background: selectedBanks.includes(bank) ? `${BANK_COLORS[bank]}15` : 'transparent',
                  color: selectedBanks.includes(bank) ? BANK_COLORS[bank] : T.muted,
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: BANK_COLORS[bank] }} />
                {bank}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '1px', background: T.border, margin: '0 10px', alignSelf: 'stretch' }} />

        {/* Modos y Rango/Meses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Visualización</span>
          <div style={{ display: 'flex', gap: '4px', background: T.input, padding: '4px', borderRadius: '8px' }}>
            <button onClick={() => setViewMode('timeline')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'timeline' ? '#3B82F6' : 'transparent', color: viewMode === 'timeline' ? '#fff' : T.text, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Diario</button>
            <button onClick={() => setViewMode('monthly_compare')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'monthly_compare' ? '#3B82F6' : 'transparent', color: viewMode === 'monthly_compare' ? '#fff' : T.text, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Mensual</button>
            <button onClick={() => setViewMode('delta')} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'delta' ? '#3B82F6' : 'transparent', color: viewMode === 'delta' ? '#fff' : T.text, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Delta %</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Tiempo / Comentarios</span>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {viewMode === 'timeline' ? (
              <div style={{ display: 'flex', gap: '4px' }}>
                {[
                  { id: 'last_30', label: '30d' },
                  { id: 'last_90', label: '90d' },
                  { id: 'all', label: 'Todo' }
                ].map(r => (
                  <button 
                    key={r.id} onClick={() => setRange(r.id)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${range === r.id ? '#3B82F6' : T.border}`, background: range === r.id ? '#3B82F620' : 'transparent', color: range === r.id ? '#3B82F6' : T.text, fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button 
                  onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '150px', justifyContent: 'space-between' }}
                >
                  {selectedMonths.length} meses seleccionados <span>▾</span>
                </button>
                {showMonthDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: T.card, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto', minWidth: '150px' }}>
                    {availableMonths.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <input type="checkbox" checked={selectedMonths.includes(m.id)} onChange={() => toggleMonth(m.id)} id={`month-${m.id}`} />
                        <label htmlFor={`month-${m.id}`} style={{ fontSize: '12px', color: T.text, cursor: 'pointer' }}>{m.label}</label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'timeline' && (
              <button 
                onClick={() => setShowComments(!showComments)}
                style={{ 
                  padding: '6px 10px', borderRadius: '6px', border: `1px solid ${showComments ? '#8B5CF6' : T.border}`,
                  background: showComments ? '#8B5CF620' : 'transparent',
                  color: showComments ? '#8B5CF6' : T.muted,
                  fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                💬 {showComments ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* GRÁFICO PRINCIPAL */}
      <div style={{ position: 'relative', background: T.card, padding: '24px', borderRadius: '20px', border: `1px solid ${T.border}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: T.text }}>
            {viewMode === 'timeline' && 'Evolución Temporal Diaria'}
            {viewMode === 'monthly_compare' && 'Comparativa Mensual Absoluta (Promedio)'}
            {viewMode === 'delta' && 'Variación Porcentual Mes a Mes (Delta %)'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: T.muted }}>
            {viewMode === 'timeline' ? 'Haz clic en un punto para agregar un comentario analítico.' : `Campañas: ${productLabelsList.join(' + ')}`}
          </p>
        </div>

        <div style={{ width: '100%', height: '500px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'timeline' ? (
              <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 20, bottom: 70 }} onClick={(e) => handleChartClick(e)}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} opacity={0.5} />
                <XAxis dataKey="date" stroke={T.muted} fontSize={10} tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')} minTickGap={30} />
                <YAxis 
                  stroke={T.muted} 
                  fontSize={10} 
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  domain={[0, (dataMax) => Math.round(dataMax * 1.4)]}
                />
                <Tooltip content={<CustomTooltip productLabels={productLabelsList} fullData={timelineData} />} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                {selectedBanks.map(bank => (
                  <Line 
                    key={bank} type="monotone" dataKey={bank} stroke={BANK_COLORS[bank]} strokeWidth={3} dot={false} 
                    activeDot={{ r: 6, strokeWidth: 0, cursor: 'pointer' }} animationDuration={500} 
                  />
                ))}
                
                {/* Marcadores de Comentarios de Bancos */}
                {showComments && timelineData.flatMap(day => 
                  selectedBanks.filter(bank => day[`${bank}_comment`]).map((bank, idx) => {
                    const yOffset = idx * 10;
                    return (
                      <ReferenceDot 
                        key={`bank-${day.date}-${bank}`}
                        x={day.date}
                        y={day[bank]}
                        r={8}
                        fill="transparent"
                        stroke="transparent"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleChartClick({ activePayload: [{ payload: day }] }, bank)}
                        label={{ 
                          value: '💬', 
                          position: 'top', 
                          fill: BANK_COLORS[bank], 
                          fontSize: 14,
                          offset: 5 + yOffset
                        }}
                      />
                    );
                  })
                )}

                {/* Marcadores de Análisis Global (Emails) */}
                {(() => {
                  if (!showComments) return null;
                  
                  // Calculamos el valor máximo visible para posicionar los iconos arriba
                  const visibleData = (brushIndices.start !== null && brushIndices.end !== null)
                    ? timelineData.slice(brushIndices.start, brushIndices.end + 1)
                    : timelineData;
                    
                  const maxVisible = Math.max(...visibleData.flatMap(d => selectedBanks.map(b => d[b] || 0)), 100);
                  const yPos = maxVisible * 1.15; // Un poco por encima del pico más alto visible

                  const daysWithAnalysis = timelineData.filter(day => day.daily_analysis);
                  
                  return [
                    ...daysWithAnalysis.map(day => (
                      <ReferenceLine 
                        key={`global-line-${day.date}`} 
                        x={day.date} 
                        stroke="#3B82F6" 
                        strokeDasharray="3 3" 
                        opacity={0.2} 
                      />
                    )),
                    ...daysWithAnalysis.map(day => (
                      <ReferenceDot 
                        key={`global-dot-${day.date}`}
                        x={day.date}
                        y={yPos}
                        r={12}
                        fill="rgba(59, 130, 246, 0.9)"
                        stroke="#fff"
                        strokeWidth={1}
                        style={{ cursor: 'pointer', filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}
                        onClick={() => handleChartClick({ activePayload: [{ payload: day }] })}
                        label={{ 
                          value: '📧', 
                          position: 'center', 
                          fill: '#fff', 
                          fontSize: 16
                        }}
                      />
                    ))
                  ];
                })()}

                {/* Indicador de Rango de Fechas (Personalizado) */}
                <foreignObject x="0" y="0" width="100%" height="100%" style={{ pointerEvents: 'none' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    width: 'calc(100% - 100px)', 
                    margin: '0 50px',
                    position: 'absolute',
                    bottom: '40px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#3B82F6',
                    textShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                  }}>
                    <span>{timelineData[brushIndices.start !== null ? brushIndices.start : 0]?.date || ''}</span>
                    <span>{timelineData[brushIndices.end !== null ? brushIndices.end : (timelineData.length - 1)]?.date || ''}</span>
                  </div>
                </foreignObject>

                <Brush 
                  key={`brush-${range}`}
                  dataKey="date" 
                  height={30} 
                  stroke="#334155" 
                  fill="#1E293B" 
                  travellerWidth={10}
                  startIndex={brushIndices.start !== null ? brushIndices.start : undefined}
                  endIndex={brushIndices.end !== null ? brushIndices.end : undefined}
                  onChange={(obj) => setBrushIndices({ start: obj.startIndex, end: obj.endIndex })}
                  tickFormatter={() => ""} // Ocultar ticks nativos
                >
                  <AreaChart>
                    <Area dataKey="BSF" stroke="#3B82F6" fill="#3B82F6" opacity={0.2} />
                  </AreaChart>
                </Brush>
              </LineChart>
            ) : viewMode === 'monthly_compare' ? (
              <BarChart data={monthlyCompareData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} opacity={0.5} />
                <XAxis dataKey="month" stroke={T.muted} fontSize={10} />
                <YAxis stroke={T.muted} fontSize={10} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} />
                <Tooltip content={<CustomTooltip productLabels={productLabelsList} fullData={rawMonthlyData} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend verticalAlign="top" height={36} />
                {selectedBanks.map(bank => (
                  <Bar key={bank} dataKey={bank} fill={BANK_COLORS[bank]} radius={[4, 4, 0, 0]} animationDuration={500} />
                ))}
              </BarChart>
            ) : (
              <BarChart data={deltaData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} opacity={0.5} />
                <XAxis dataKey="month" stroke={T.muted} fontSize={10} />
                <YAxis stroke={T.muted} fontSize={10} tickFormatter={(val) => `${val}%`} />
                <Tooltip content={<CustomTooltip productLabels={productLabelsList} fullData={deltaData} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend verticalAlign="top" height={36} />
                <ReferenceLine y={0} stroke={T.muted} />
                {selectedBanks.map(bank => (
                  <Bar key={bank} dataKey={bank} animationDuration={500} radius={[2,2,2,2]}>
                    {deltaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry[bank] >= 0 ? '#10B981' : '#EF4444'} opacity={0.8} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* MODAL EDITOR COMENTARIO */}
        {editingComment && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}
               onClick={(e) => e.target === e.currentTarget && setEditingComment(null)}>
            <div ref={modalRef} style={{ background: T.card, padding: '24px', borderRadius: '20px', border: `1px solid ${T.border}`, width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', position: 'relative' }}>
              
              <button 
                onClick={() => setEditingComment(null)}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: T.muted, fontSize: '18px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>

              <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: T.text }}>Análisis Diario - {editingComment.date}</h4>
              
              {!editingComment.bank && !editingComment.isGlobal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    onClick={() => setEditingComment({ ...editingComment, isGlobal: true, comment: editingComment.daily_analysis || "" })}
                    style={{ 
                      display: 'flex', flexDirection: 'column', gap: '4px', 
                      padding: '14px', borderRadius: '10px', border: '1px solid #3B82F6', 
                      background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', cursor: 'pointer', 
                      marginBottom: '4px', textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13px' }}>
                      <span>📧</span> Análisis Global del Día
                    </div>
                    {editingComment.daily_analysis && (
                      <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic', lineHeight: '1.4', marginTop: '4px' }}>
                        {editingComment.daily_analysis}
                      </div>
                    )}
                  </button>

                  <p style={{ fontSize: '12px', color: T.muted, margin: '8px 0 4px' }}>O selecciona un banco para comentario específico:</p>
                  {editingComment._allData.map(p => {
                    const bankComment = p.payload[`${p.dataKey}_comment`];
                    return (
                      <button 
                        key={p.dataKey}
                        onClick={() => setEditingComment({ ...editingComment, bank: p.dataKey, comment: bankComment || "", delta: p.delta })}
                        style={{ 
                          display: 'flex', flexDirection: 'column', gap: '4px', 
                          padding: '12px 14px', borderRadius: '10px', border: `1px solid ${BANK_COLORS[p.dataKey]}40`, 
                          background: `${BANK_COLORS[p.dataKey]}10`, color: BANK_COLORS[p.dataKey], 
                          cursor: 'pointer', textAlign: 'left' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <span style={{ fontWeight: 700 }}>{p.dataKey}</span>
                          {p.delta && (
                            <span style={{ fontSize: '11px', fontWeight: 800, color: Number(p.delta) > 0 ? '#10B981' : Number(p.delta) < 0 ? '#EF4444' : '#94A3B8' }}>
                              {Number(p.delta) > 0 ? '↑ ' : Number(p.delta) < 0 ? '↓ ' : ''}{Math.abs(p.delta)}%
                            </span>
                          )}
                        </div>
                        {bankComment && (
                          <div style={{ fontSize: '11px', opacity: 0.8, fontStyle: 'italic', lineHeight: '1.4', marginTop: '2px' }}>
                            {bankComment}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => setEditingComment({ ...editingComment, bank: null, isGlobal: false })}
                        style={{ background: 'transparent', border: 'none', color: '#3B82F6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '0 4px 0 0' }}
                      >
                        ← Volver
                      </button>
                      {editingComment.isGlobal ? (
                        <span style={{ fontWeight: 800, color: '#3B82F6' }}>Análisis Global</span>
                      ) : (
                        <span style={{ fontWeight: 800, color: BANK_COLORS[editingComment.bank] }}>{editingComment.bank}</span>
                      )}
                    </div>
                    {!editingComment.isGlobal && editingComment.delta && (
                      <span style={{ fontSize: '12px', fontWeight: 800, color: Number(editingComment.delta) > 0 ? '#10B981' : Number(editingComment.delta) < 0 ? '#EF4444' : '#94A3B8', background: Number(editingComment.delta) > 0 ? '#10B98115' : Number(editingComment.delta) < 0 ? '#EF444415' : '#94A3B815', padding: '2px 8px', borderRadius: '6px' }}>
                        {Number(editingComment.delta) > 0 ? '↑ ' : Number(editingComment.delta) < 0 ? '↓ ' : ''}{Math.abs(editingComment.delta)}%
                      </span>
                    )}
                  </div>
                  <textarea 
                    autoFocus
                    value={editingComment.comment}
                    onChange={(e) => setEditingComment({ ...editingComment, comment: e.target.value })}
                    placeholder={editingComment.isGlobal ? "Escribe el análisis general que se envió por mail..." : "Escribe el por qué de la caída o subida..."}
                    style={{ width: '100%', minHeight: '120px', padding: '12px', borderRadius: '12px', border: `1px solid ${T.border}`, background: T.input, color: T.text, fontSize: '13px', outline: 'none', resize: 'none', lineHeight: '1.5' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button onClick={() => setEditingComment({ ...editingComment, bank: null, isGlobal: false })}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${T.border}`, background: 'transparent', color: T.text, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={saveComment} disabled={isSaving}
                      style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: '#3B82F6', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)' }}>
                      {isSaving ? 'Guardando...' : '💾 Grabar comentario'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REPORTE DETALLADO DIARIO (Transpuesto: Bancos en Filas, Días en Columnas) */}
        {viewMode === 'timeline' && (
        <div style={{ background: T.card, padding: '24px', borderRadius: '20px', border: `1px solid ${T.border}`, overflowX: 'auto', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: T.text, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📄 Reporte Ejecutivo Diario</span>
              <span style={{ fontSize: '10px', color: '#3B82F6', background: '#3B82F615', padding: '2px 8px', borderRadius: '12px' }}>
                {productLabelsList.join(' + ')}
              </span>
            </h4>
            <span style={{ fontSize: '11px', color: T.muted }}>
              Mostrando { (brushIndices.end !== null ? brushIndices.end : timelineData.length-1) - (brushIndices.start || 0) + 1 } días seleccionados
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', color: T.text, fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '120px' }}>Banco / Fecha</th>
                {(brushIndices.start !== null && brushIndices.end !== null 
                  ? timelineData.slice(brushIndices.start, brushIndices.end + 1)
                  : timelineData
                ).map(day => (
                  <th key={day.date} style={{ padding: '12px 8px', fontSize: '10px', whiteSpace: 'nowrap' }}>
                    {formatDate(day.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Filas para cada Banco seleccionado */}
              {selectedBanks.map(bank => (
                <tr key={bank} style={{ borderBottom: `1px solid ${T.border}30` }}>
                  <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, color: BANK_COLORS[bank], borderRight: `1px solid ${T.border}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: BANK_COLORS[bank] }} />
                      {bank}
                    </div>
                  </td>
                  {(brushIndices.start !== null && brushIndices.end !== null 
                    ? timelineData.slice(brushIndices.start, brushIndices.end + 1)
                    : timelineData
                  ).map(day => {
                    const originalIdx = timelineData.findIndex(d => d.date === day.date);
                    const prevDay = originalIdx > 0 ? timelineData[originalIdx - 1] : null;
                    const val = day[bank] || 0;
                    const prevVal = prevDay ? (prevDay[bank] || 0) : 0;
                    const delta = prevVal ? (((val - prevVal) / prevVal) * 100).toFixed(1) : null;
                    const isUp = delta > 0;
                    const isDown = delta < 0;
                    const deltaCol = isUp ? '#10B981' : isDown ? (Math.abs(delta) <= 10 ? '#F59E0B' : '#EF4444') : T.muted;

                    return (
                      <td key={day.date} style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{new Intl.NumberFormat('es-AR').format(val)}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          {delta !== null && (
                            <span style={{ fontSize: '9px', color: deltaCol }}>
                              {isUp ? '↑' : isDown ? '↓' : ''} {Math.abs(delta)}%
                            </span>
                          )}
                          {day[`${bank}_comment`] && <span title={day[`${bank}_comment`]} style={{ fontSize: '10px', cursor: 'help' }}>💬</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Fila: Total Industria */}
              <tr style={{ borderTop: `2px solid ${T.border}`, background: 'rgba(59, 130, 246, 0.03)' }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 800, color: T.text }}>TOTAL</td>
                {(brushIndices.start !== null && brushIndices.end !== null 
                  ? timelineData.slice(brushIndices.start, brushIndices.end + 1)
                  : timelineData
                ).map(day => {
                  const originalIdx = timelineData.findIndex(d => d.date === day.date);
                  const prevDay = originalIdx > 0 ? timelineData[originalIdx - 1] : null;
                  const total = selectedBanks.reduce((sum, b) => sum + (day[b] || 0), 0);
                  const totalValPrev = prevDay ? selectedBanks.reduce((sum, b) => sum + (prevDay[b] || 0), 0) : 0;
                  const totalDelta = totalValPrev ? (((total - totalValPrev) / totalValPrev) * 100).toFixed(1) : null;
                  const isUp = totalDelta > 0;
                  const isDown = totalDelta < 0;
                  const deltaCol = isUp ? '#10B981' : isDown ? (Math.abs(totalDelta) <= 10 ? '#F59E0B' : '#EF4444') : T.muted;

                  return (
                    <td key={day.date} style={{ padding: '12px 8px', fontWeight: 800 }}>
                      <div>{new Intl.NumberFormat('es-AR').format(total)}</div>
                      {totalDelta !== null && (
                        <div style={{ fontSize: '9px', color: deltaCol }}>
                          {isUp ? '↑' : isDown ? '↓' : ''} {Math.abs(totalDelta)}%
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Fila Final: Análisis (Iconos) */}
              <tr style={{ borderTop: `1px solid ${T.border}` }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontSize: '10px', color: T.muted, fontWeight: 700 }}>ANÁLISIS GLOBAL</td>
                {(brushIndices.start !== null && brushIndices.end !== null 
                  ? timelineData.slice(brushIndices.start, brushIndices.end + 1)
                  : timelineData
                ).map(day => (
                  <td key={day.date} style={{ padding: '12px 8px', textAlign: 'center' }}>
                    {day.daily_analysis ? <span title={day.daily_analysis} style={{ cursor: 'help', fontSize: '14px' }}>📧</span> : <span style={{ opacity: 0.2 }}>-</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {/* TABLA RESUMEN (Visible en modos mensuales) */}
      {viewMode !== 'timeline' && (
        <div style={{ background: T.card, padding: '24px', borderRadius: '20px', border: `1px solid ${T.border}`, overflowX: 'auto' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: T.text }}>Comparativa Evolutiva por Banco</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', color: T.text, fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.muted }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', minWidth: '120px' }}>Banco / Mes</th>
                {monthlyCompareData.map(row => (
                  <th key={row.month} style={{ padding: '12px 8px', fontSize: '10px', textTransform: 'uppercase' }}>
                    {formatMonth(row.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Filas para cada Banco seleccionado */}
              {selectedBanks.map(bank => (
                <tr key={bank} style={{ borderBottom: `1px solid ${T.border}40` }}>
                  <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 700, color: BANK_COLORS[bank], borderRight: `1px solid ${T.border}40` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: BANK_COLORS[bank] }} />
                      {bank}
                    </div>
                  </td>
                  {monthlyCompareData.map((row, i) => {
                    const val = row[bank] || 0;
                    const prevRow = i > 0 ? monthlyCompareData[i-1] : null;
                    const prevVal = prevRow ? (prevRow[bank] || 0) : 0;
                    const delta = prevVal ? (((val - prevVal) / prevVal) * 100).toFixed(1) : null;
                    const isUp = delta > 0;
                    const isDown = delta < 0;
                    const deltaCol = isUp ? '#10B981' : isDown ? (Math.abs(delta) <= 10 ? '#F59E0B' : '#EF4444') : T.muted;

                    return (
                      <td key={row.month} style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{new Intl.NumberFormat('es-AR').format(val)}</div>
                        {delta !== null && (
                          <div style={{ fontSize: '10px', color: deltaCol }}>
                            {isUp ? '↑' : isDown ? '↓' : ''} {Math.abs(delta)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              
              {/* Fila Final: Total Industria */}
              <tr style={{ borderTop: `2px solid ${T.border}`, background: 'rgba(59, 130, 246, 0.03)' }}>
                <td style={{ padding: '12px 8px', textAlign: 'left', fontWeight: 800, color: T.text }}>TOTAL INDUSTRIA</td>
                {monthlyCompareData.map((row, i) => {
                  const total = selectedBanks.reduce((sum, b) => sum + (row[b] || 0), 0);
                  const prevRow = i > 0 ? monthlyCompareData[i-1] : null;
                  const prevTotal = prevRow ? selectedBanks.reduce((sum, b) => sum + (prevRow[b] || 0), 0) : 0;
                  const totalDelta = prevTotal ? (((total - prevTotal) / prevTotal) * 100).toFixed(1) : null;
                  const isUp = totalDelta > 0;
                  const isDown = totalDelta < 0;
                  const deltaCol = isUp ? '#10B981' : isDown ? (Math.abs(totalDelta) <= 10 ? '#F59E0B' : '#EF4444') : T.muted;

                  return (
                    <td key={row.month} style={{ padding: '12px 8px', fontWeight: 800 }}>
                      <div>{new Intl.NumberFormat('es-AR').format(total)}</div>
                      {totalDelta !== null && (
                        <div style={{ fontSize: '10px', color: deltaCol }}>
                          {isUp ? '↑' : isDown ? '↓' : ''} {Math.abs(totalDelta)}%
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* COMPONENTES SECUNDARIOS (Visible solo en timeline) */}
      {viewMode === 'timeline' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          <div style={{ background: T.card, padding: '20px', borderRadius: '16px', border: `1px solid ${T.border}` }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: T.text }}>Distribución por Banco</h4>
            <div style={{ width: '100%', height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timelineData.length > 0 ? [timelineData[timelineData.length-1]] : []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis fontSize={10} stroke={T.muted} />
                  <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip productLabels={productLabelsList} />} />
                  {selectedBanks.map(bank => (
                    <Bar key={bank} dataKey={bank} fill={BANK_COLORS[bank]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: T.card, padding: '20px', borderRadius: '16px', border: `1px solid ${T.border}` }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: T.text }}>Volumen Total</h4>
            <div style={{ width: '100%', height: '250px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData.map(d => ({ ...d, total: selectedBanks.reduce((sum, b) => sum + (d[b] || 0), 0) }))}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" hide />
                  <YAxis fontSize={10} stroke={T.muted} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="#3B82F6" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
