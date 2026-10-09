import React, { useEffect, useMemo, useRef, useState } from 'react';

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export default function MultiSearchableSelect({
  values = [],
  onChange,
  options = [],
  placeholder = 'Selecciona...',
  searchPlaceholder = 'Escribe para buscar...',
  ariaLabel = 'Selector múltiple con búsqueda',
  className = ''
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const safeOptions = useMemo(() => options.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt), [options]);
  const selectedValues = useMemo(() => new Set((values || []).map(String)), [values]);
  const selectedOptions = safeOptions.filter(opt => selectedValues.has(String(opt.value)));
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return safeOptions;
    return safeOptions.filter(opt => normalize(`${opt.label || ''} ${opt.searchText || ''}`).includes(q));
  }, [safeOptions, query]);

  useEffect(() => {
    const onDoc = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = value => {
    const key = String(value);
    const next = selectedValues.has(key)
      ? (values || []).filter(v => String(v) !== key)
      : [...(values || []), value];
    onChange?.(next);
  };

  const remove = value => onChange?.((values || []).filter(v => String(v) !== String(value)));

  return <div ref={wrapRef} className={`multi-searchable-select ${open ? 'is-open' : ''} ${className}`.trim()}>
    <div className="multi-searchable-control" onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}>
      <div className="multi-searchable-values">
        {selectedOptions.map(opt => <span className="multi-searchable-chip" key={String(opt.value)}>{opt.label}<button type="button" aria-label={`Quitar ${opt.label}`} onClick={e => { e.stopPropagation(); remove(opt.value); }}>×</button></span>)}
        <input
          ref={inputRef}
          type="text"
          aria-label={ariaLabel}
          autoComplete="off"
          value={query}
          placeholder={selectedOptions.length ? searchPlaceholder : placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'Backspace' && !query && selectedOptions.length) remove(selectedOptions[selectedOptions.length - 1].value);
          }}
        />
      </div>
      <button type="button" className="multi-searchable-chevron" tabIndex={-1} onClick={e => { e.stopPropagation(); setOpen(v => !v); requestAnimationFrame(() => inputRef.current?.focus()); }}>⌄</button>
    </div>
    {open && <div className="multi-searchable-menu">
      {filtered.length === 0 ? <div className="searchable-select-empty">Sin resultados</div> : filtered.map(opt => {
        const selected = selectedValues.has(String(opt.value));
        return <button type="button" key={String(opt.value)} className={selected ? 'is-selected' : ''} onClick={() => toggle(opt.value)}><span>{opt.label}</span><strong>{selected ? '✓' : ''}</strong></button>;
      })}
    </div>}
  </div>;
}
