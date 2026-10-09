import React, { useEffect, useMemo, useRef, useState } from 'react';

const normalize = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Selecciona...',
  searchPlaceholder = 'Escribe para buscar...',
  disabled = false,
  className = '',
  required = false,
  ariaLabel = 'Selector con búsqueda'
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const safeOptions = useMemo(() => options.map((opt) => (
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )), [options]);

  const selected = safeOptions.find((opt) => String(opt.value) === String(value));
  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return safeOptions;
    return safeOptions.filter((opt) => normalize(`${opt.label || ''} ${opt.searchText || ''}`).includes(q));
  }, [safeOptions, query]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const onDoc = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (opt) => {
    onChange?.(opt.value);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.blur());
  };

  const onKeyDown = (event) => {
    if (!open && ['ArrowDown', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapRef} className={`searchable-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
      {required && <input className="searchable-select-required-proxy" tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}} />}
      <div className="searchable-select-control">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          placeholder={open ? searchPlaceholder : placeholder}
          value={open ? query : (selected?.label || '')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onClick={() => { if (!disabled) setOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        <button type="button" tabIndex={-1} aria-label="Abrir opciones" disabled={disabled} onClick={() => { setOpen((v) => !v); setQuery(''); inputRef.current?.focus(); }}>
          <span className="searchable-select-chevron">⌄</span>
        </button>
      </div>
      {open && !disabled && (
        <div className="searchable-select-menu" role="listbox">
          {filtered.length === 0 ? (
            <div className="searchable-select-empty">Sin resultados</div>
          ) : filtered.map((opt, index) => (
            <button
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              key={`${opt.value}-${index}`}
              className={`${index === active ? 'is-active' : ''} ${String(opt.value) === String(value) ? 'is-selected' : ''}`.trim()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(opt)}
            >
              <span>{opt.label}</span>
              {String(opt.value) === String(value) && <strong>✓</strong>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
