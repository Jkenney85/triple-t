export type FieldType = 'number' | 'percent' | 'currency' | 'text' | 'url' | 'date';
export type TotalMode = 'sum' | 'avg' | 'none';
export type VideoStatus = 'pending' | 'ok' | 'error';
/** How a list orders its cards. "day" is the default: day-of-week groups, then manual order. */
export type ColumnSort = 'day' | 'title' | 'due';

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
  isAdmin: boolean;
  isActive: boolean;
}

export interface Board {
  id: number;
  name: string;
  color: string;
  /** URL of the uploaded wallpaper (webp), or null. A "-thumb.webp" sibling exists for previews. */
  backgroundImage: string | null;
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Column {
  id: number;
  boardId: number;
  name: string;
  position: number;
  isDone: boolean;
  /** Optional "#rrggbb" tint for the list, or null. */
  color: string | null;
  sort: ColumnSort;
  /** Cards in this list that have a due date get a highlighter outline. */
  highlightDue: boolean;
}

export interface Label {
  id: number;
  boardId: number;
  name: string;
  color: string;
}

export interface Field {
  id: number;
  boardId: number;
  name: string;
  type: FieldType;
  showOnFront: boolean;
  totalMode: TotalMode;
  position: number;
}

export interface Card {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  notes: string;
  bannerColor: string | null;
  bannerText: string;
  dayOfWeek: number | null;
  position: number;
  dueAt: number | null;
  productUrl: string;
  labelIds: number[];
  archivedAt: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Comment {
  id: number;
  cardId: number;
  /** The video this comment belongs to; null for older card-level comments. */
  videoId: number | null;
  userId: number;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Video {
  id: number;
  cardId: number;
  url: string;
  title: string;
  author: string;
  /** Path the browser can load the locally stored thumbnail from, or null. */
  thumbnail: string | null;
  status: VideoStatus;
  error: string | null;
  position: number;
  /** Metric values by month: "YYYY-MM" -> fieldId -> raw value. */
  months: Record<string, Record<string, string>>;
  createdBy: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Remembered banner text for a color on a board. */
export interface BannerPreset {
  id: number;
  boardId: number;
  color: string;
  text: string;
}

export interface BoardState {
  board: Board;
  columns: Column[];
  labels: Label[];
  fields: Field[];
  cards: Card[];
  videos: Video[];
  comments: Comment[];
  bannerPresets: BannerPreset[];
}

export interface Removed {
  columns?: number[];
  labels?: number[];
  fields?: number[];
  cards?: number[];
  videos?: number[];
  comments?: number[];
  bannerPresets?: number[];
}

/** Incremental change to a board, sent over Socket.IO and returned from mutations. */
export interface Patch {
  boardId: number;
  board?: Board;
  columns?: Column[];
  labels?: Label[];
  fields?: Field[];
  cards?: Card[];
  videos?: Video[];
  comments?: Comment[];
  bannerPresets?: BannerPreset[];
  removed?: Removed;
  /** Set when the board's archived-items list changed. */
  archivedChanged?: boolean;
}

export interface SearchResult {
  cardId: number;
  boardId: number;
  boardName: string;
  columnName: string;
  title: string;
  snippet: string;
  archived: boolean;
}

export interface PresenceUser {
  id: number;
  displayName: string;
  avatarColor: string;
}
