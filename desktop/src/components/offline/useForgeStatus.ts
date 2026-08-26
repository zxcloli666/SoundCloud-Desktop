import {useEffect, useState} from 'react';
import {getTranscodeStatus, type TranscodeStatus} from '../../lib/cache';

const POLL_MS = 2500;

function sameStatus(a: TranscodeStatus | null, b: TranscodeStatus): boolean {
  return (
    a !== null &&
    a.ffmpeg === b.ffmpeg &&
    a.incoming === b.incoming &&
    a.incomingBytes === b.incomingBytes &&
    a.queued === b.queued &&
    a.transcoding === b.transcoding &&
    a.clean === b.clean &&
    a.cleanBytes === b.cleanBytes &&
    a.transcodingUrns.join() === b.transcodingUrns.join()
  );
}

/** Live-статус кузницы А→Б: поллинг с паузой при скрытом окне; ссылка на
 *  снапшот стабильна, пока конвейер не шевелится — лишних ре-рендеров нет. */
export function useForgeStatus(): TranscodeStatus | null {
  const [status, setStatus] = useState<TranscodeStatus | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    let disposed = false;

    const tick = () => {
      void getTranscodeStatus()
        .then((s) => {
          if (!disposed) setStatus((prev) => (sameStatus(prev, s) ? prev : s));
        })
        .catch(() => {});
    };
    const start = () => {
      if (timer !== null) return;
      tick();
      timer = window.setInterval(tick, POLL_MS);
    };
    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else start();
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState !== 'hidden') start();

    return () => {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return status;
}
