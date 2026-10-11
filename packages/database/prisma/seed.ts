import { prisma } from "../src/index.js";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@next-kanban.local" },
    update: {},
    create: {
      id: "demo-user",
      email: "demo@next-kanban.local",
      name: "Demo User",
    },
  });

  const existing = await prisma.board.findUnique({
    where: { id: "demo-board" },
  });

  if (!existing) {
    await prisma.board.create({
      data: {
        id: "demo-board",
        title: "Realtime Launch",
        slug: "realtime-launch",
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
        columns: {
          create: [
            {
              id: "todo",
              title: "To do",
              position: 1000,
              cards: {
                create: [
                  {
                    id: "card-sync",
                    title: "Define sync protocol",
                    description: "Version mutations and make retries idempotent.",
                    position: 1000,
                    createdById: user.id,
                  },
                  {
                    id: "card-presence",
                    title: "Add presence cursors",
                    description: "Broadcast cursor updates as ephemeral events.",
                    position: 2000,
                    createdById: user.id,
                  }
                ]
              }
            },
            {
              id: "doing",
              title: "In progress",
              position: 2000,
              cards: {
                create: [
                  {
                    id: "card-board",
                    title: "Build collaborative board",
                    description: "Optimistic drag-and-drop with server authority.",
                    position: 1000,
                    createdById: user.id
                  }
                ]
              }
            },
            {
              id: "done",
              title: "Done",
              position: 3000,
              cards: {
                create: [
                  {
                    id: "card-schema",
                    title: "Model board data",
                    description: "Board, columns, cards, members, and event log.",
                    position: 1000,
                    createdById: user.id
                  }
                ]
              }
            }
          ]
        }
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
