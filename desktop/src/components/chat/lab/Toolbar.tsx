import { type CSSProperties, useState } from 'react';
import { type LabPerf, type LabScheme, paramsUrl, readParams } from './params';
import { labScenes } from './scenes';

const BAR: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 10,
  transform: 'translateX(-50%)',
  zIndex: 2147483647,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  padding: '6px 8px',
  borderRadius: 12,
  font: '12px system-ui',
  color: '#eee',
  background: 'rgb(18 18 24 / 0.92)',
  border: '1px solid rgb(255 255 255 / 0.14)',
};

function go(change: Parameters<typeof paramsUrl>[0]) {
  window.location.assign(paramsUrl(change));
}

function Select({
  value,
  options,
  onPick,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onPick(event.target.value)}
      style={{ background: '#222', color: '#eee', border: '1px solid #444', borderRadius: 6 }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const pick = (values: string[]) => values.map((value) => ({ value, label: value }));

export function Toolbar() {
  const params = readParams();
  const [open, setOpen] = useState(true);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 2147483647, opacity: 0.5 }}
      >
        lab
      </button>
    );
  }
  return (
    <div data-chat-lab-bar style={BAR}>
      <Select
        label="scene"
        value={params.scene ?? labScenes[0]?.id ?? ''}
        options={labScenes.map((scene) => ({ value: scene.id, label: scene.title }))}
        onPick={(scene) => go({ scene })}
      />
      <Select
        label="scheme"
        value={params.scheme ?? 'dark'}
        options={pick(['dark', 'white'])}
        onPick={(scheme) => go({ scheme: scheme as LabScheme })}
      />
      <Select
        label="perf"
        value={params.perf ?? 'beauty'}
        options={pick(['beauty', 'medium', 'light'])}
        onPick={(perf) => go({ perf: perf as LabPerf })}
      />
      <Select
        label="lang"
        value={params.lang ?? 'ru'}
        options={pick(['ru', 'en', 'ko', 'tr'])}
        onPick={(lang) => go({ lang })}
      />
      <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={params.motion === 'reduce'}
          onChange={(event) => go({ motion: event.target.checked ? 'reduce' : null })}
        />
        reduce
      </label>
      <button type="button" onClick={() => setOpen(false)} aria-label="hide">
        x
      </button>
    </div>
  );
}
