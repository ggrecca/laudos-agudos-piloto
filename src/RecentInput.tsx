import { useId, useState, type ChangeEvent, type KeyboardEvent } from "react";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};
export function RecentInput({ label, value, options, onChange, disabled, placeholder, multiline, "aria-invalid": invalid, "aria-describedby": describedBy }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(-1);
  const choices = [...new Set(options.map(v => v.trim()).filter(Boolean))]
    .filter(v => v.toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR"))).slice(0, 8);
  const shown = open && !disabled && choices.length > 0;
  function choose(v: string) { onChange(v); setOpen(false); setActive(-1); }
  function keyDown(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === "Escape") { setOpen(false); setActive(-1); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!choices.length) return;
      e.preventDefault(); setOpen(true);
      setActive(i => e.key === "ArrowDown" ? (i + 1) % choices.length : (i <= 0 ? choices.length - 1 : i - 1));
    }
    if (e.key === "Enter" && shown && active >= 0 && choices[active]) { e.preventDefault(); choose(choices[active]); }
  }
  const props = {
    value, disabled, placeholder, autoComplete: "off",
    "aria-invalid": invalid, "aria-describedby": describedBy,
    role: "combobox" as const, "aria-label": label, "aria-expanded": shown,
    "aria-autocomplete": "list" as const, "aria-controls": shown ? id : undefined,
    "aria-activedescendant": shown && active >= 0 ? id + "-" + active : undefined,
    onFocus: () => { setFilter(""); setActive(-1); setOpen(true); },
    onBlur: () => { setOpen(false); setActive(-1); },
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { onChange(e.target.value); setFilter(e.target.value); setActive(-1); setOpen(true); },
    onKeyDown: keyDown,
  };
  return <div className="recent-input">
    {multiline ? <textarea {...props} /> : <input {...props} />}
    {shown && <ul className="recent-options" id={id} role="listbox" aria-label={"Valores recentes de " + label}>
      {choices.map((v, i) => <li key={v} role="option" id={id + "-" + i} aria-selected={active === i}
        className={active === i ? "selected" : ""} onMouseDown={e => e.preventDefault()}
        onPointerDown={e => { if (e.pointerType === "touch") e.preventDefault(); }} onClick={() => choose(v)}>{v}</li>)}
    </ul>}
  </div>;
}
