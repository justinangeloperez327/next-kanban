import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type {
  BoardEventEnvelope,
  BoardSnapshot,
  ClientToServerEvents,
  ServerToClientEvents,
} from "@next-kanban/contracts";
import { prisma } from "@next-kanban/database";
import { boardRole, verifySocketToken } from "@next-kanban/auth";

const port = Number(process.env.PORT ?? 4001);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "next-kanban-realtime" });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: webOrigin,
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const roomForBoard = (boardId: string) => `board:${boardId}`;
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string") throw new Error("Missing token");
    const userId = await verifySocketToken(token);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new Error("Unknown user");
    socket.data.userId = userId;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  socket.on("board:join", async ({ boardId, afterSequence }, ack) => {
    if (!(await boardRole(boardId, socket.data.userId))) {
      ack({ ok: false, code: "NOT_FOUND", message: "Board not found." });
      return;
    }
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
            },
          },
        },
      },
    });

    if (!board) {
      ack({ ok: false, code: "NOT_FOUND", message: "Board not found." });
      return;
    }

    await socket.join(roomForBoard(boardId));

    const events = await prisma.boardEvent.findMany({
      where: {
        boardId,
        ...(afterSequence ? { id: { gt: BigInt(afterSequence) } } : {}),
      },
      orderBy: { id: "asc" },
      take: 500,
    });

    const snapshot: BoardSnapshot = {
      id: board.id,
      title: board.title,
      slug: board.slug,
      version: board.version,
      columns: board.columns.map((column) => ({
        id: column.id,
        boardId: column.boardId,
        title: column.title,
        position: column.position,
        version: column.version,
        cards: column.cards.map((card) => ({
          id: card.id,
          columnId: card.columnId,
          title: card.title,
          description: card.description,
          position: card.position,
          version: card.version,
        })),
      })),
    };

    const replay: BoardEventEnvelope[] = events.map((event) => ({
      sequence: event.id.toString(),
      boardId: event.boardId,
      mutationId: event.mutationId,
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    }));

    ack({ ok: true, snapshot, events: replay });
  });

  socket.on("card:move", async (input, ack) => {
    const role = await boardRole(input.boardId, socket.data.userId);
    if (role !== "OWNER" && role !== "EDITOR") {
      ack({ ok: false, code: "INVALID", message: "Permission denied." });
      return;
    }
    if (
      !input.boardId ||
      !input.cardId ||
      !input.targetColumnId ||
      !input.mutationId ||
      !Number.isFinite(input.position)
    ) {
      ack({ ok: false, code: "INVALID", message: "Invalid card move." });
      return;
    }

    const previous = await prisma.boardEvent.findUnique({
      where: { mutationId: input.mutationId },
    });

    if (previous && previous.boardId === input.boardId) {
      const payload = previous.payload as { version?: number };
      ack({
        ok: true,
        version: payload.version ?? input.baseVersion + 1,
        sequence: previous.id.toString(),
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const targetColumn = await tx.column.findFirst({
        where: { id: input.targetColumnId, boardId: input.boardId },
        select: { id: true },
      });

      if (!targetColumn) {
        return { kind: "not-found" as const };
      }

      const updated = await tx.card.updateMany({
        where: {
          id: input.cardId,
          version: input.baseVersion,
          column: { boardId: input.boardId },
        },
        data: {
          columnId: input.targetColumnId,
          position: input.position,
          version: { increment: 1 },
        },
      });

      if (updated.count !== 1) {
        return { kind: "conflict" as const };
      }

      const card = await tx.card.findUniqueOrThrow({
        where: { id: input.cardId },
        select: { version: true },
      });

      const event = await tx.boardEvent.create({
        data: {
          boardId: input.boardId,
          mutationId: input.mutationId,
          eventType: "card.moved",
          payload: {
            cardId: input.cardId,
            targetColumnId: input.targetColumnId,
            position: input.position,
            version: card.version,
          },
        },
      });

      return {
        kind: "ok" as const,
        version: card.version,
        sequence: event.id.toString(),
      };
    });

    if (result.kind === "not-found") {
      ack({ ok: false, code: "NOT_FOUND", message: "Target column not found." });
      return;
    }

    if (result.kind === "conflict") {
      ack({
        ok: false,
        code: "CONFLICT",
        message: "The card changed on another client. Refresh from server state.",
      });
      return;
    }

    const event = {
      boardId: input.boardId,
      cardId: input.cardId,
      targetColumnId: input.targetColumnId,
      position: input.position,
      version: result.version,
      mutationId: input.mutationId,
      sequence: result.sequence,
    };

    socket.to(roomForBoard(input.boardId)).emit("card:moved", event);
    ack({ ok: true, version: result.version, sequence: result.sequence });
  });

  socket.on("presence:update", async (input) => {
    if (!socket.rooms.has(roomForBoard(input.boardId))) return;
    if (!(await boardRole(input.boardId, socket.data.userId))) return;
    socket.volatile
      .to(roomForBoard(input.boardId))
      .emit("presence:updated", { ...input, userId: socket.data.userId });
  });
});

httpServer.listen(port, () => {
  console.log(`Realtime server listening on http://localhost:${port}`);
});
