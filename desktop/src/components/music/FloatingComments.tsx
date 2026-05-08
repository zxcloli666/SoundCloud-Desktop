import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import React, { useEffect, useRef } from 'react';
import { art } from '../../lib/formatters';
import type { Comment } from '../../lib/hooks';
import { useTrackComments } from '../../lib/hooks';
import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';

interface Pill {
  id: number;
  comment: Comment;
  addedAt: number;
}

interface NativeFloatingComment {
  id: number;
  body: string;
  timestamp_ms: number;
  user_avatar_url: string | null;
}

function getMaxVisible(): number {
  const h = window.innerHeight;
  if (h < 540) return 1;
  if (h < 720) return 2;
  if (h < 960) return 3;
  return 4;
}

export const FloatingComments = React.memo(function FloatingComments() {
  const enabled = useSettingsStore((s) => s.floatingComments);
  const trackUrn = usePlayerStore((s) => s.currentTrack?.urn);

  if (!enabled || !trackUrn) return null;
  return <FloatingCommentsInner trackUrn={trackUrn} />;
});

const FloatingCommentsInner = React.memo(function FloatingCommentsInner({
  trackUrn,
}: {
  trackUrn: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillsRef = useRef<Pill[]>([]);
  const shownIds = useRef(new Set<number>());
  const nextPillId = useRef(0);

  const { comments } = useTrackComments(trackUrn);

  // Filter comments with timestamp and body
  const timedComments = useRef<Comment[]>([]);
  useEffect(() => {
    timedComments.current = comments.filter((c) => c.timestamp != null && c.body);
    shownIds.current.clear();

    void invoke('audio_set_comments_timeline', {
      comments: timedComments.current.map((comment) => ({
        id: comment.id,
        body: comment.body,
        timestampMs: comment.timestamp ?? 0,
        userAvatarUrl: comment.user.avatar_url || null,
      })),
    });

    return () => {
      void invoke('audio_clear_comments_timeline');
    };
  }, [comments]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const unlistenPromise = listen<NativeFloatingComment>('comments:show', (event) => {
      const now = Date.now();
      const container = containerRef.current;
      if (!container) return;
      const maxVisible = getMaxVisible();
      const comment = timedComments.current.find((item) => item.id === event.payload.id);
      if (!comment || shownIds.current.has(comment.id) || pillsRef.current.length >= maxVisible) {
        return;
      }

      shownIds.current.add(comment.id);
      const pill: Pill = { id: nextPillId.current++, comment, addedAt: now };
      pillsRef.current.push(pill);
      renderPill(container, pill);
      window.setTimeout(() => {
        const el = container.querySelector(`[data-pill-id="${pill.id}"]`) as HTMLElement | null;
        if (el) {
          el.style.opacity = '0';
          el.style.transform = 'translateY(8px)';
          window.setTimeout(() => el.remove(), 300);
        }
        pillsRef.current = pillsRef.current.filter((entry) => entry.id !== pill.id);
      }, 5500);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    pillsRef.current = [];
    nextPillId.current = 0;
    container.replaceChildren();
  }, [trackUrn]);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-2 items-center pointer-events-none"
    />
  );
});

function renderPill(container: HTMLDivElement, pill: Pill) {
  const { comment } = pill;
  const el = document.createElement('div');
  el.setAttribute('data-pill-id', String(pill.id));
  el.className =
    'flex items-center gap-2.5 px-4 py-2 rounded-full backdrop-blur-xl border border-white/10 pointer-events-auto transition-all duration-300 ease-out';
  el.style.cssText = 'background: rgba(255,255,255,0.08); transform: scale(0.5); opacity: 0;';

  const avatar = document.createElement('img');
  avatar.src = art(comment.user.avatar_url, 'small') || '';
  avatar.className = 'w-7 h-7 rounded-full object-cover shrink-0';
  avatar.alt = '';

  const body = document.createElement('span');
  body.className = 'text-[13px] text-white/80 max-w-[300px] truncate';
  body.textContent = comment.body;

  el.appendChild(avatar);
  el.appendChild(body);

  if (comment.timestamp != null) {
    const ts = document.createElement('span');
    const sec = Math.floor(comment.timestamp / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    ts.className = 'text-[11px] text-white/30 tabular-nums shrink-0';
    ts.textContent = `${m}:${String(s).padStart(2, '0')}`;
    el.appendChild(ts);
  }

  container.prepend(el);

  // Trigger enter animation
  requestAnimationFrame(() => {
    el.style.transform = 'scale(1)';
    el.style.opacity = '1';
  });
}
