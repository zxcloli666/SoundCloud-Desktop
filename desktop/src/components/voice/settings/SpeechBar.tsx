import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Keyboard } from '../../../lib/icons';
import { voiceIpc } from '../../../lib/voice/ipc';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { Dots } from '../island/parts';

export function SpeechBar({ example }: { example: string }) {
  const { t } = useTranslation();
  const engine = useVoiceRuntime((s) => s.engine);
  const partial = useVoiceRuntime((s) => s.partial);
  const [text, setText] = useState('');
  const live = engine === 'listening' || engine === 'thinking';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    void voiceIpc.text(value, 'typed').catch(() => {});
    setText('');
  };

  if (live) {
    return (
      <div className="flex h-12 items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.06] px-4">
        <span
          className="size-2 shrink-0 rounded-full bg-accent motion-reduce:animate-none"
          style={{
            animation: 'vx-wait 1.1s ease-in-out infinite',
            boxShadow: '0 0 10px var(--color-accent-glow)',
          }}
        />
        <span
          className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${partial ? 'text-ink-90' : 'text-ink-40'}`}
        >
          {partial || (
            <span className="inline-flex items-center gap-2">
              {engine === 'thinking' ? t('voice.hud.thinking') : t('voice.hero.sayIt')}
              <Dots />
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="group flex h-12 items-center gap-3 rounded-2xl border border-ink/[0.08] bg-shade-20 px-4 transition-colors duration-300 focus-within:border-accent/50 hover:border-ink/[0.14]"
    >
      <Keyboard
        size={15}
        className="shrink-0 text-ink-30 transition-colors group-focus-within:text-accent"
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('voice.quote', { text: example })}
        aria-label={t('voice.hero.typeLabel')}
        className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-ink-90 outline-none placeholder:text-ink-30"
      />
      {text.trim() && (
        <button
          type="submit"
          aria-label={t('voice.hero.send')}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-accent text-accent-contrast transition-transform hover:scale-105 active:scale-95"
        >
          <ArrowRight size={14} />
        </button>
      )}
    </form>
  );
}
