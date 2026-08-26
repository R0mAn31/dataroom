import { describe, expect, it } from "vitest";
import { GET as listRooms, POST as createRoom } from "@/app/api/rooms/route";
import { DELETE as deleteRoom, PATCH as renameRoom } from "@/app/api/rooms/[roomId]/route";
import { db } from "@/lib/db";
import { createUser, jsonRequest, params, signInAs } from "./helpers";

describe("POST /api/rooms", () => {
  it("rejects an unauthenticated request", async () => {
    signInAs(null);
    const res = await createRoom(jsonRequest("http://t/api/rooms", "POST", { name: "Neptune" }));
    expect(res.status).toBe(401);
  });

  it("creates a room owned by the signed-in user", async () => {
    const owner = await createUser();
    signInAs(owner);

    const res = await createRoom(jsonRequest("http://t/api/rooms", "POST", { name: "  Neptune  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Neptune"); // normalizeName trims whitespace
    expect(body.ownerId).toBe(owner.id);
  });

  it("rejects an empty name", async () => {
    const owner = await createUser();
    signInAs(owner);
    const res = await createRoom(jsonRequest("http://t/api/rooms", "POST", { name: "   " }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/rooms", () => {
  it("only lists rooms owned by the caller, with stats", async () => {
    const owner = await createUser();
    const other = await createUser({ email: "other@test.local" });
    await db.dataRoom.create({ data: { name: "Mine", ownerId: owner.id } });
    await db.dataRoom.create({ data: { name: "Theirs", ownerId: other.id } });

    signInAs(owner);
    const res = await listRooms();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ name: "Mine", files: 0, folders: 0, bytes: 0, shared: false });
  });
});

describe("PATCH /api/rooms/:roomId", () => {
  it("renames a room the caller owns", async () => {
    const owner = await createUser();
    const room = await db.dataRoom.create({ data: { name: "Old", ownerId: owner.id } });
    signInAs(owner);

    const res = await renameRoom(
      jsonRequest(`http://t/api/rooms/${room.id}`, "PATCH", { name: "New" }),
      params({ roomId: room.id })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("New");
  });

  it("returns 404 rather than leaking existence of another owner's room", async () => {
    const owner = await createUser();
    const attacker = await createUser({ email: "attacker@test.local" });
    const room = await db.dataRoom.create({ data: { name: "Secret", ownerId: owner.id } });

    signInAs(attacker);
    const res = await renameRoom(
      jsonRequest(`http://t/api/rooms/${room.id}`, "PATCH", { name: "Hacked" }),
      params({ roomId: room.id })
    );
    expect(res.status).toBe(404);

    const stillOld = await db.dataRoom.findUniqueOrThrow({ where: { id: room.id } });
    expect(stillOld.name).toBe("Secret");
  });
});

describe("DELETE /api/rooms/:roomId", () => {
  it("cascades to folders and files owned by the room", async () => {
    const owner = await createUser();
    const room = await db.dataRoom.create({ data: { name: "Doomed", ownerId: owner.id } });
    const folder = await db.folder.create({
      data: { name: "Sub", roomId: room.id, parentId: null, path: "/" },
    });
    await db.file.create({
      data: { name: "a.pdf", roomId: room.id, folderId: folder.id, size: 1, mimeType: "application/pdf" },
    });

    signInAs(owner);
    const res = await deleteRoom(jsonRequest(`http://t/api/rooms/${room.id}`, "DELETE"), params({ roomId: room.id }));
    expect(res.status).toBe(200);

    expect(await db.dataRoom.findUnique({ where: { id: room.id } })).toBeNull();
    expect(await db.folder.findUnique({ where: { id: folder.id } })).toBeNull();
    expect(await db.file.count({ where: { roomId: room.id } })).toBe(0);
  });
});
