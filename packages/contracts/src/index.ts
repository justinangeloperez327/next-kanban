export type CardSnapshot = {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  position: number;
  version: number;
};

export type ColumnSnapshot = {
  id: string;
  boardId: string;
  title: string;
  position: number;
  version: number;
  cards: CardSnapshot[];
};

export type BoardSnapshot = {
  id: string;
  title: string;
  slug: string;
  version: number;
  columns: ColumnSnapshot[];
};

export type BoardEventEnvelope = {
  sequence: string;
  boardId: string;
  mutationId: string;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

export type MutationAck =
  | { ok: true; version: number; sequence: string }
  | { ok: false; code: "CONFLICT" | "NOT_FOUND" | "INVALID"; message: string };

export type JoinBoardAck =
  | { ok: true; snapshot: BoardSnapshot; events: BoardEventEnvelope[] }
  | { ok: false; code: "NOT_FOUND"; message: string };

export type MoveCardInput = {
  boardId: string;
  cardId: string;
  targetColumnId: string;
  position: number;
  baseVersion: number;
  mutationId: string;
};

export type PresenceUpdate = {
  boardId: string;
  userId: string;
  displayName: string;
  x: number;
  y: number;
};

export interface ClientToServerEvents {
  "board:join": (
    input: { boardId: string; afterSequence?: string },
    ack: (result: JoinBoardAck) => void,
  ) => void;
  "card:move": (input: MoveCardInput, ack: (result: MutationAck) => void) => void;
  "presence:update": (input: PresenceUpdate) => void;
}

export interface ServerToClientEvents {
  "card:moved": (input: {
    boardId: string;
    cardId: string;
    targetColumnId: string;
    position: number;
    version: number;
    mutationId: string;
    sequence: string;
  }) => void;
  "presence:updated": (input: PresenceUpdate) => void;
}
