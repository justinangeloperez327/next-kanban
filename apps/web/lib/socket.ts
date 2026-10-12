import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@next-kanban/contracts";

export type KanbanSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
let socket: KanbanSocket | null = null;

export function getSocket(): KanbanSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001", {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: async (callback) => {
        try {
          const response = await fetch("/api/auth/socket-token", { method: "POST" });
          if (!response.ok) throw new Error("Unauthorized");
          callback(await response.json());
        } catch {
          callback({ token: "" });
        }
      },
    });
  }
  return socket;
}
