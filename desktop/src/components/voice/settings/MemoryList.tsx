import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from '../../../lib/icons';
import { addNote, NOTE_MAX } from '../../../lib/voice/chat/notes';
import { useVoiceStore } from '../../../lib/voice/store';

function Note({ text, onForget }: { text: string; onForget: () => void }) {
  const { t } = useTranslation();
  return (
    <li
      className="group flex items-start gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.03] py-1.5 pl-3 pr-1.5 motion-reduce:animate-none"
      style={{ animation: 'vx-pop 320ms var(--ease-apple) both' }}
    >
      <span className="selectable min-w-0 flex-1 py-0.5 text-[12.5px] leading-snug text-ink-80">
        {text}
      </span>
      <button
        type="button"
        onClick={onForget}
        aria-label={t('voice.chat.memoryForget')}
        title={t('voice.chat.memoryForget')}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-35 transition-colors duration-200 hover:bg-bad/10 hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
      >
        <X size={12} />
      </button>
    </li>
  );
}

function AddNote({ onAdd }: { onAdd: (text: string) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };
  return (
    <form
      onSubmit={submit}
      className="group flex h-9 items-center gap-2 rounded-xl border border-dashed border-ink/[0.12] px-3 transition-colors duration-300 focus-within:border-accent/50 focus-within:border-solid hover:border-ink/[0.2]"
    >
      <Plus
        size={13}
        className="shrink-0 text-ink-30 transition-colors group-focus-within:text-accent"
      />
      <input
        value={text}
        maxLength={NOTE_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('voice.chat.memoryAdd')}
        aria-label={t('voice.chat.memoryAdd')}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink-90 outline-none placeholder:text-ink-30"
      />
    </form>
  );
}

export function MemoryList() {
  const { t } = useTranslation();
  const notes = useVoiceStore((s) => s.notes);
  const setNotes = useVoiceStore((s) => s.setNotes);

  return (
    <div data-ui="voice-memory" className="space-y-2">
      {notes.length === 0 ? (
        <p className="text-[12px] text-ink-40">{t('voice.chat.memoryEmpty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((note, i) => (
            <Note
              key={note}
              text={note}
              onForget={() => setNotes(notes.filter((_, at) => at !== i))}
            />
          ))}
        </ul>
      )}
      <AddNote onAdd={(text) => setNotes(addNote(notes, text))} />
    </div>
  );
}
