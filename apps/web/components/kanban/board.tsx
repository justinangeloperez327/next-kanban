"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { BoardSnapshot, CardSnapshot } from "@next-kanban/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

function CardItem({ card }: { card: CardSnapshot }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
      data: { card },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={[
        "cursor-grab rounded-xl border border-white/10 bg-neutral-900 p-4 shadow-sm",
        "transition-opacity active:cursor-grabbing",
        isDragging ? "z-50 opacity-70" : "",
      ].join(" ")}
    >
      <h3 className="text-sm font-medium text-neutral-100">{card.title}</h3>
      {card.description ? (
        <p className="mt-2 text-xs leading-5 text-neutral-400">
          {card.description}
        </p>
      ) : null}
      <div className="mt-4 text-[11px] text-neutral-600">v{card.version}</div>
    </article>
  );
}

function Column({
  id,
  title,
  cards,
}: {
  id: string;
  title: string;
  cards: CardSnapshot[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section
      ref={setNodeRef}
      className={[
        "min-h-[420px] w-[320px] shrink-0 rounded-2xl border p-3",
        isOver
          ? "border-blue-500/60 bg-blue-500/5"
          : "border-white/10 bg-white/[0.025]",
      ].join(" ")}
    >
      <header className="flex items-center justify-between px-1 pb-3">
        <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-neutral-500">
          {cards.length}
        </span>
      </header>
      <div className="space-y-2">
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function KanbanBoard({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [connection, setConnection] = useState<
    "connecting" | "online" | "offline"
  >("connecting");
  const [lastSequence, setLastSequence] = useState<string | undefined>();
  const lastSequenceRef = useRef<string | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const cardsById = useMemo(() => {
    const entries =
      board?.columns.flatMap((column) =>
        column.cards.map((card) => [card.id, card] as const),
      ) ?? [];
    return new Map(entries);
  }, [board]);

  const applyRemoteMove = useCallback(
    (event: {
      cardId: string;
      targetColumnId: string;
      position: number;
      version: number;
      sequence: string;
    }) => {
      lastSequenceRef.current = event.sequence;
      setLastSequence(event.sequence);
      setBoard((current) => {
        if (!current) return current;

        let moved: CardSnapshot | undefined;

        const without = current.columns.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => {
            if (card.id === event.cardId) {
              moved = {
                ...card,
                columnId: event.targetColumnId,
                position: event.position,
                version: event.version,
              };
              return false;
            }
            return true;
          }),
        }));

        if (!moved) return current;

        return {
          ...current,
          columns: without.map((column) =>
            column.id === event.targetColumnId
              ? {
                  ...column,
                  cards: [...column.cards, moved!].sort(
                    (a, b) => a.position - b.position,
                  ),
                }
              : column,
          ),
        };
      });
    },
    [],
  );

  useEffect(() => {
    const socket = getSocket();

    const join = () => {
      setConnection("online");
      socket.emit(
        "board:join",
        { boardId, afterSequence: lastSequenceRef.current },
        (result) => {
          if (result.ok) {
            setBoard(result.snapshot);
            const latest = result.events.at(-1);
            if (latest) {
              lastSequenceRef.current = latest.sequence;
              setLastSequence(latest.sequence);
            }
          }
        },
      );
    };

    const offline = () => setConnection("offline");

    socket.on("connect", join);
    socket.on("disconnect", offline);
    socket.on("card:moved", applyRemoteMove);
    socket.connect();

    return () => {
      socket.off("connect", join);
      socket.off("disconnect", offline);
      socket.off("card:moved", applyRemoteMove);
      socket.disconnect();
    };
  }, [applyRemoteMove, boardId]);

  const moveCardOptimistically = (
    cardId: string,
    targetColumnId: string,
    position: number,
  ) => {
    setBoard((current) => {
      if (!current) return current;

      let moved: CardSnapshot | undefined;
      const columns = current.columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          if (card.id === cardId) {
            moved = { ...card, columnId: targetColumnId, position };
            return false;
          }
          return true;
        }),
      }));

      if (!moved) return current;

      return {
        ...current,
        columns: columns.map((column) =>
          column.id === targetColumnId
            ? {
                ...column,
                cards: [...column.cards, moved!].sort(
                  (a, b) => a.position - b.position,
                ),
              }
            : column,
        ),
      };
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!board || !over) return;

    const card = cardsById.get(String(active.id));
    const targetColumn = board.columns.find(
      (column) => column.id === String(over.id),
    );

    if (!card || !targetColumn || card.columnId === targetColumn.id) return;

    const previousBoard = board;
    const position = (targetColumn.cards.at(-1)?.position ?? 0) + 1000;
    const mutationId = crypto.randomUUID();

    moveCardOptimistically(card.id, targetColumn.id, position);

    getSocket().emit(
      "card:move",
      {
        boardId,
        cardId: card.id,
        targetColumnId: targetColumn.id,
        position,
        baseVersion: card.version,
        mutationId,
      },
      (result) => {
        if (!result.ok) {
          setBoard(previousBoard);
          return;
        }

        lastSequenceRef.current = result.sequence;
        setLastSequence(result.sequence);
        setBoard((current) =>
          current
            ? {
                ...current,
                columns: current.columns.map((column) => ({
                  ...column,
                  cards: column.cards.map((item) =>
                    item.id === card.id
                      ? { ...item, version: result.version }
                      : item,
                  ),
                })),
              }
            : current,
        );
      },
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
            Collaborative project canvas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {board?.title ?? "Loading board…"}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-400">
          <span
            className={[
              "size-2 rounded-full",
              connection === "online"
                ? "bg-emerald-400"
                : connection === "connecting"
                  ? "bg-amber-400"
                  : "bg-neutral-600",
            ].join(" ")}
          />
          {connection}
        </div>
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {board?.columns.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              title={column.title}
              cards={column.cards}
            />
          ))}
        </div>
      </DndContext>

      <footer className="mt-2 text-xs text-neutral-600">
        {lastSequence
          ? `Synced through event #${lastSequence}`
          : "Waiting for first sync"}
      </footer>
    </div>
  );
}
