/**
 * Centralized icon exports.
 *
 * 1) Memo-wrapped lucide components — prevent SVG re-renders when parent updates.
 *    Lucide v0.576 uses forwardRef but NOT memo, so we add it here.
 * 2) Pre-rendered JSX constants — referentially stable, zero cost on re-render.
 */
import {
  AlertCircle as _AlertCircle,
  ArrowDownToLine as _ArrowDownToLine,
  ArrowRight as _ArrowRight,
  AudioLines as _AudioLines,
  Bookmark as _Bookmark,
  Calendar as _Calendar,
  ChartNoAxesColumn as _ChartNoAxesColumn,
  Check as _Check,
  ChevronDown as _ChevronDown,
  ChevronLeft as _ChevronLeft,
  ChevronRight as _ChevronRight,
  ChevronUp as _ChevronUp,
  ClipboardCopy as _ClipboardCopy,
  Clock as _Clock,
  Cloud as _Cloud,
  Compass as _Compass,
  Copy as _Copy,
  Crown as _Crown,
  Database as _Database,
  Disc3 as _Disc3,
  Download as _Download,
  ExternalLink as _ExternalLink,
  Eye as _Eye,
  FileDown as _FileDown,
  FileText as _FileText,
  Flame as _Flame,
  FolderOpen as _FolderOpen,
  Fullscreen as _Fullscreen,
  Globe as _Globe,
  GripVertical as _GripVertical,
  Hash as _Hash,
  Headphones as _Headphones,
  Heart as _Heart,
  Home as _Home,
  Library as _Library,
  Link as _Link,
  Link2 as _Link2,
  ListMusic as _ListMusic,
  ListPlus as _ListPlus,
  Loader2 as _Loader2,
  Lock as _Lock,
  MapPin as _MapPin,
  MessageCircle as _MessageCircle,
  MicVocal as _MicVocal,
  Minus as _Minus,
  MonitorPlay as _MonitorPlay,
  Moon as _Moon,
  Music as _Music,
  PanelLeftClose as _PanelLeftClose,
  PanelLeftOpen as _PanelLeftOpen,
  Pause as _Pause,
  Play as _Play,
  Plus as _Plus,
  Power as _Power,
  Radio as _Radio,
  RefreshCw as _RefreshCw,
  Repeat as _Repeat,
  Repeat1 as _Repeat1,
  Repeat2 as _Repeat2,
  RotateCcw as _RotateCcw,
  Search as _Search,
  Send as _Send,
  Settings as _Settings,
  Shuffle as _Shuffle,
  SkipBack as _SkipBack,
  SkipForward as _SkipForward,
  SlidersHorizontal as _SlidersHorizontal,
  Smartphone as _Smartphone,
  Sparkles as _Sparkles,
  Square as _Square,
  Star as _Star,
  Sun as _Sun,
  Sunrise as _Sunrise,
  Sunset as _Sunset,
  ThumbsDown as _ThumbsDown,
  Trash2 as _Trash2,
  TrendingDown as _TrendingDown,
  TrendingUp as _TrendingUp,
  Trophy as _Trophy,
  User as _User,
  Users as _Users,
  Volume1 as _Volume1,
  Volume2 as _Volume2,
  VolumeX as _VolumeX,
  Wifi as _Wifi,
  WifiOff as _WifiOff,
  X as _X,
} from 'lucide-react';
import { memo } from 'react';
import { siInstagram, siX, siYoutube } from 'simple-icons';

// ── Simple Icons (brand icons, replaces deprecated lucide brands) ──
const SimpleIcon = memo(
  ({
    icon,
    size = 24,
    className,
  }: {
    icon: { path: string };
    size?: number;
    className?: string;
  }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d={icon.path} />
    </svg>
  ),
);

// ── Memo-wrapped icon components ────────────────────────────
export const AlertCircle = memo(_AlertCircle);
export const ArrowDownToLine = memo(_ArrowDownToLine);
export const Calendar = memo(_Calendar);
export const ChartNoAxesColumn = memo(_ChartNoAxesColumn);
export const Crown = memo(_Crown);
export const FileDown = memo(_FileDown);
export const FileText = memo(_FileText);
export const FolderOpen = memo(_FolderOpen);
export const Flame = memo(_Flame);
export const Moon = memo(_Moon);
export const Sun = memo(_Sun);
export const Sunrise = memo(_Sunrise);
export const Sunset = memo(_Sunset);
export const TrendingDown = memo(_TrendingDown);
export const TrendingUp = memo(_TrendingUp);
export const Trophy = memo(_Trophy);
export const Wifi = memo(_Wifi);
export const WifiOff = memo(_WifiOff);
export const Check = memo(_Check);
export const ClipboardCopy = memo(_ClipboardCopy);
export const Download = memo(_Download);
export const ChevronDown = memo(_ChevronDown);
export const ChevronLeft = memo(_ChevronLeft);
export const ArrowRight = memo(_ArrowRight);
export const ChevronRight = memo(_ChevronRight);
export const ChevronUp = memo(_ChevronUp);
export const Clock = memo(_Clock);
export const Bookmark = memo(_Bookmark);
export const Cloud = memo(_Cloud);
export const Compass = memo(_Compass);
export const Copy = memo(_Copy);
export const Database = memo(_Database);
export const Disc3 = memo(_Disc3);
export const ExternalLink = memo(_ExternalLink);
export const Eye = memo(_Eye);
export const Fullscreen = memo(_Fullscreen);
export const Globe = memo(_Globe);
export const GripVertical = memo(_GripVertical);
export const Hash = memo(_Hash);
export const Headphones = memo(_Headphones);
export const Heart = memo(_Heart);
export const Home = memo(_Home);
export const Instagram = memo(({ size, className }: { size?: number; className?: string }) => (
  <SimpleIcon icon={siInstagram} size={size} className={className} />
));
export const Library = memo(_Library);
export const LinkIcon = memo(_Link);
export const ListMusic = memo(_ListMusic);
export const ListPlus = memo(_ListPlus);
export const Loader2 = memo(_Loader2);
export const Lock = memo(_Lock);
export const MapPin = memo(_MapPin);
export const MicVocal = memo(_MicVocal);
export const MonitorPlay = memo(_MonitorPlay);
export const MessageCircle = memo(_MessageCircle);
export const Minus = memo(_Minus);
export const Music = memo(_Music);
export const PanelLeftClose = memo(_PanelLeftClose);
export const PanelLeftOpen = memo(_PanelLeftOpen);
export const Pause = memo(_Pause);
export const Play = memo(_Play);
export const Plus = memo(_Plus);
export const Repeat = memo(_Repeat);
export const Repeat1 = memo(_Repeat1);
export const RefreshCw = memo(_RefreshCw);
export const Repeat2 = memo(_Repeat2);
export const Search = memo(_Search);
export const Send = memo(_Send);
export const Settings = memo(_Settings);
export const Shuffle = memo(_Shuffle);
export const Smartphone = memo(_Smartphone);
export const SkipBack = memo(_SkipBack);
export const SkipForward = memo(_SkipForward);
export const Sparkles = memo(_Sparkles);
export const Star = memo(_Star);
export const Square = memo(_Square);
export const ThumbsDown = memo(_ThumbsDown);
export const Trash2 = memo(_Trash2);
export const Twitter = memo(({ size, className }: { size?: number; className?: string }) => (
  <SimpleIcon icon={siX} size={size} className={className} />
));
export const User = memo(_User);
export const Users = memo(_Users);
export const Volume1 = memo(_Volume1);
export const Volume2 = memo(_Volume2);
export const VolumeX = memo(_VolumeX);
export const X = memo(_X);
export const Link = memo(_Link2);
export const SlidersHorizontal = memo(_SlidersHorizontal);
export const AudioLines = memo(_AudioLines);
export const Power = memo(_Power);
export const Radio = memo(_Radio);
export const RotateCcw = memo(_RotateCcw);
export const Youtube = memo(({ size, className }: { size?: number; className?: string }) => (
  <SimpleIcon icon={siYoutube} size={size} className={className} />
));

// ── Pre-rendered JSX constants (hot-path, fixed props) ──────

// Play / Pause (filled, black)
export const playBlack11 = <_Play size={11} fill="black" strokeWidth={0} className="ml-px" />;
export const pauseBlack11 = <_Pause size={11} fill="black" strokeWidth={0} />;
export const playBlack12 = <_Play size={12} fill="black" strokeWidth={0} className="ml-px" />;
export const pauseBlack12 = <_Pause size={12} fill="black" strokeWidth={0} />;
export const playBlack14 = <_Play size={14} fill="black" strokeWidth={0} className="ml-px" />;
export const pauseBlack14 = <_Pause size={14} fill="black" strokeWidth={0} />;
export const playBlack18 = <_Play size={18} fill="black" strokeWidth={0} className="ml-0.5" />;
export const pauseBlack18 = <_Pause size={18} fill="black" strokeWidth={0} />;
export const playBlack20 = <_Play size={20} fill="black" strokeWidth={0} className="ml-0.5" />;
export const pauseBlack20 = <_Pause size={20} fill="black" strokeWidth={0} />;
export const playBlack22 = <_Play size={22} fill="black" strokeWidth={0} className="ml-0.5" />;
export const pauseBlack22 = <_Pause size={22} fill="black" strokeWidth={0} />;

// Play / Pause (filled, inherits color via currentColor — use text-accent-contrast on parent)
export const playWhite12 = (
  <_Play size={12} fill="currentColor" strokeWidth={0} className="ml-px" />
);
export const pauseWhite12 = <_Pause size={12} fill="currentColor" strokeWidth={0} />;
export const playWhite14 = (
  <_Play size={14} fill="currentColor" strokeWidth={0} className="ml-0.5" />
);
export const pauseWhite14 = <_Pause size={14} fill="currentColor" strokeWidth={0} />;
export const playWhite16 = (
  <_Play size={16} fill="currentColor" strokeWidth={0} className="ml-0.5" />
);

// Play / Pause (filled, currentColor)
export const playCurrent16 = <_Play size={16} fill="currentColor" strokeWidth={0} />;
export const pauseCurrent16 = <_Pause size={16} fill="currentColor" strokeWidth={0} />;

// Play / Pause (outline / misc)
export const playIcon32 = <_Play size={32} />;
export const playBlack20ml1 = <_Play size={20} fill="black" className="ml-1" />;
export const pauseTextWhite12 = <_Pause size={12} className="text-white" />;

// Transport controls
export const skipBack20 = <_SkipBack size={20} fill="currentColor" />;
export const skipForward20 = <_SkipForward size={20} fill="currentColor" />;
export const shuffleIcon16 = <_Shuffle size={16} />;
export const repeatIcon16 = <_Repeat size={16} />;
export const repeat1Icon16 = <_Repeat1 size={16} />;
// A-B segment loop: brackets framing a small loop arrow (a bounded repeat).
export const repeatAbIcon16 = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M8 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h2" />
    <path d="M16 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2" />
    <path d="M14.5 10.5a3 3 0 1 0 .4 4" />
    <path d="M15 8v3h-3" />
  </svg>
);

// Volume
export const volumeXIcon16 = <_VolumeX size={16} />;
export const volume1Icon16 = <_Volume1 size={16} />;
export const volume2Icon16 = <_Volume2 size={16} />;

// Info icons (small, for stats)
export const headphones9 = <_Headphones size={9} />;
export const headphones11 = <_Headphones size={11} className="text-white/20" />;
export const heart9 = <_Heart size={9} />;
export const heart11 = <_Heart size={11} className="text-white/20" />;
export const listMusic8 = <_ListMusic size={8} />;
export const listMusic9 = <_ListMusic size={9} />;
export const listMusic16 = <_ListMusic size={16} />;
export const musicIcon12 = <_Music size={12} className="text-white/15" />;
export const musicIcon14 = <_Music size={14} className="text-white/15" />;
export const musicIcon22 = <_Music size={22} className="text-white/15" />;
export const musicIcon20 = <_Music size={16} className="text-white/20" />;
export const audioLines16 = <_AudioLines size={16} />;
export const slidersHorizontal16 = <_SlidersHorizontal size={16} />;
