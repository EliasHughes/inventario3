import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X } from "lucide-react";

/**
 * Typeahead reutilizable con debounce.
 *
 * Props:
 * - endpoint: URL de búsqueda (ej: "/employees/search", "/assets/search")
 * - params: params extras (ej: { available_only: true })
 * - value: objeto seleccionado (o null)
 * - onChange: (item) => void
 * - placeholder
 * - renderItem: (item) => ReactNode (sugerencia)
 * - renderSelected: (item) => ReactNode (texto en input cuando hay selección)
 * - testId
 * - minChars (default 2)
 */
export default function Typeahead({
  endpoint, params = {}, value, onChange,
  placeholder = "Escriba para buscar...",
  renderItem, renderSelected,
  testId, minChars = 2,
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < minChars) { setItems([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(endpoint, { params: { q: q.trim(), ...params } });
        setItems(data.items || []);
        setHighlight(0);
      } catch { setItems([]); }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open, endpoint, JSON.stringify(params), minChars]);

  const pick = (it) => {
    onChange && onChange(it);
    setOpen(false); setQ("");
  };
  const clear = () => { onChange && onChange(null); setQ(""); inputRef.current?.focus(); };

  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter" && items[highlight]) { e.preventDefault(); pick(items[highlight]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {value ? (
        <div className="flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm"
             data-testid={testId ? `${testId}-selected` : undefined}>
          <div className="min-w-0 truncate">{renderSelected ? renderSelected(value) : (value.name || value.code)}</div>
          <button type="button" onClick={clear} className="ml-2 rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
                  data-testid={testId ? `${testId}-clear` : undefined} aria-label="Limpiar selección">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input ref={inputRef} value={q}
                 onFocus={() => setOpen(true)}
                 onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                 onKeyDown={onKey}
                 placeholder={placeholder} className="pl-9"
                 data-testid={testId} />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
        </div>
      )}
      {open && !value && q.trim().length >= minChars && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg"
             data-testid={testId ? `${testId}-suggestions` : undefined}>
          {loading ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Buscando...</div>
          ) : items.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Sin resultados</div>
          ) : items.map((it, idx) => (
            <button key={it.id} type="button"
                    onClick={() => pick(it)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-secondary ${idx === highlight ? "bg-secondary" : ""}`}
                    data-testid={testId ? `${testId}-option-${idx}` : undefined}>
              {renderItem ? renderItem(it) : (it.name || it.code)}
            </button>
          ))}
        </div>
      )}
      {open && !value && q.trim().length > 0 && q.trim().length < minChars && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-white shadow-lg">
          <div className="p-3 text-center text-xs text-muted-foreground">Escriba al menos {minChars} caracteres…</div>
        </div>
      )}
    </div>
  );
}
