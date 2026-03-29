import { THEMES, QUARTERS, buildQuery } from "../constants";

export function PeriodSelector({ filter, onChange, T }) {
  const theme = T || THEMES.light;
  const options = [
    { label: "Últimos 3 sprints", value: "last_3", filter: { type: "last_n", n: 3 } },
    ...QUARTERS.map((q) => ({
      label: q.label,
      value: q.value,
      filter: { type: "quarter", quarter: q.quarter, year: q.year },
    })),
  ];
  const current = options.find((o) => {
    if (filter.type === "last_n" && o.filter.type === "last_n") return true;
    if (filter.type === "quarter" && o.filter.type === "quarter")
      return o.filter.quarter === filter.quarter;
    return false;
  });
  return (
    <select
      value={current?.value || "last_3"}
      onChange={(e) => {
        const opt = options.find((o) => o.value === e.target.value);
        if (opt) onChange(opt.filter);
      }}
      style={{
        padding: "7px 12px", borderRadius: 8, border: `1px solid ${theme.inputBorder}`,
        fontSize: 13, color: theme.text, background: theme.input, cursor: "pointer", outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
