import { Fragment, memo, type ReactNode, useMemo, useState } from 'react';
import { inviteToken } from '../../../lib/chat/invite-link';
import { type Segment, safeUrl, segments } from '../../../lib/chat/spans';
import type { RichText } from '../../../lib/chat/types';
import { useThread } from '../thread/context';
import { isRequest } from '../thread/permissions';
import { InviteLink } from './InviteLink';
import { useChatLinks } from './useChatLinks';

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+|scd:\/\/invite\?token=[A-Za-z0-9%_-]+/gi;
const URL_TRAILING = /[).,!?»;:\]}…*'"]+$/;
const LINK_LABEL_MAX = 56;

function linkLabel(url: string): string {
  const bare = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  return bare.length > LINK_LABEL_MAX ? `${bare.slice(0, LINK_LABEL_MAX - 1)}…` : bare;
}

const LinkText = memo(function LinkText({ url, children }: { url: string; children: ReactNode }) {
  const { openUrl } = useChatLinks();
  return (
    <button
      type="button"
      title={url}
      onClick={(event) => {
        event.stopPropagation();
        openUrl(url);
      }}
      className="inline cursor-pointer break-all text-left underline decoration-1 underline-offset-[3px] transition-opacity duration-150 hover:opacity-80"
      style={{ color: 'var(--color-accent-hover)' }}
    >
      {children}
    </button>
  );
});

const MentionText = memo(function MentionText({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const { me } = useThread();
  const { openUser } = useChatLinks();
  const self = userId === me;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openUser(userId);
      }}
      className={`inline cursor-pointer rounded-[5px] font-semibold transition-colors duration-150 ${
        self ? 'px-0.5 text-white' : 'text-[var(--color-accent-hover)] hover:underline'
      }`}
      style={self ? { background: 'var(--color-accent-glow)' } : undefined}
    >
      {children}
    </button>
  );
});

function Spoiler({ text, children }: { text: string; children: ReactNode }) {
  const { t } = useThread();
  const [shown, setShown] = useState(false);
  if (shown) return <span className="rounded-[4px] bg-ink/[0.06]">{children}</span>;
  const reveal = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setShown(true);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t('chat.thread.bubble.spoiler')}
      onClick={reveal}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') reveal(event);
      }}
      className="cursor-pointer select-none rounded-[4px] bg-ink/[0.16] text-transparent transition-colors duration-150 hover:bg-ink/[0.22]"
    >
      {text}
    </span>
  );
}

function linkNode(raw: string, key: number): ReactNode {
  const token = inviteToken(raw);
  if (token) return <InviteLink key={key} token={token} />;
  const url = safeUrl(raw);
  if (!url) return null;
  return (
    <LinkText key={key} url={url}>
      {linkLabel(raw)}
    </LinkText>
  );
}

function autoLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(URL_TRAILING, '');
    const start = match.index ?? 0;
    const node = linkNode(raw, start);
    if (!node) continue;
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(node);
    cursor = start + raw.length;
  }
  if (parts.length === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function SegmentView({ segment, links }: { segment: Segment; links: boolean }) {
  const plain = segment.code || segment.link || !links;
  let node: ReactNode = plain ? segment.text : autoLinks(segment.text);
  if (segment.code) {
    node = (
      <code className="rounded-[5px] bg-black/30 px-[3px] py-px font-mono text-[0.9em] text-ink-90 ring-1 ring-ink/[0.08] ring-inset">
        {node}
      </code>
    );
  }
  if (segment.bold) node = <strong className="font-semibold text-white">{node}</strong>;
  if (segment.italic) node = <em>{node}</em>;
  if (segment.link && links) node = <LinkText url={segment.link}>{node}</LinkText>;
  else if (segment.mention) node = <MentionText userId={segment.mention}>{node}</MentionText>;
  return node;
}

function runs(parts: Segment[]): { spoiler: boolean; parts: Segment[] }[] {
  const result: { spoiler: boolean; parts: Segment[] }[] = [];
  for (const part of parts) {
    const last = result[result.length - 1];
    if (last && last.spoiler === part.spoiler) last.parts.push(part);
    else result.push({ spoiler: part.spoiler, parts: [part] });
  }
  return result;
}

export const MessageText = memo(function MessageText({ rich }: { rich: RichText }) {
  const { conversation } = useThread();
  const links = !isRequest(conversation);
  const grouped = useMemo(() => runs(segments(rich)), [rich]);
  return grouped.map((run, index) => {
    const nodes = run.parts.map((part, at) => (
      <SegmentView key={at} segment={part} links={links} />
    ));
    if (!run.spoiler) return <Fragment key={index}>{nodes}</Fragment>;
    return (
      <Spoiler key={index} text={run.parts.map((part) => part.text).join('')}>
        {nodes}
      </Spoiler>
    );
  });
});
