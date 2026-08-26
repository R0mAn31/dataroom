import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  canReadFile,
  canUseShare,
  childPathOf,
  folderStats,
  folderSubtreeIds,
  resolveShareByToken,
  roomStats,
  shareCoversFile,
  shareCoversFolder,
} from "@/lib/access";
import { createUser } from "./helpers";

async function createRoomTree(ownerId: string) {
  const room = await db.dataRoom.create({ data: { name: "Neptune", ownerId } });
  const financials = await db.folder.create({
    data: { name: "Financials", roomId: room.id, parentId: null, path: "/" },
  });
  const audit = await db.folder.create({
    data: {
      name: "2024 audit",
      roomId: room.id,
      parentId: financials.id,
      path: childPathOf(financials),
    },
  });
  const legal = await db.folder.create({
    data: { name: "Legal", roomId: room.id, parentId: null, path: "/" },
  });
  const rootFile = await db.file.create({
    data: { name: "Teaser.pdf", roomId: room.id, folderId: null, size: 100, mimeType: "application/pdf" },
  });
  const auditFile = await db.file.create({
    data: { name: "Statements.pdf", roomId: room.id, folderId: audit.id, size: 200, mimeType: "application/pdf" },
  });
  return { room, financials, audit, legal, rootFile, auditFile };
}

describe("folder subtree queries (materialized path)", () => {
  it("finds a folder and all of its descendants via one prefix query", async () => {
    const owner = await createUser();
    const { financials, audit } = await createRoomTree(owner.id);

    const ids = await folderSubtreeIds(financials);
    expect(ids.sort()).toEqual([financials.id, audit.id].sort());
  });

  it("does not include sibling folders outside the subtree", async () => {
    const owner = await createUser();
    const { financials, legal } = await createRoomTree(owner.id);

    const ids = await folderSubtreeIds(financials);
    expect(ids).not.toContain(legal.id);
  });

  it("computes subtree file count and total size, excluding files elsewhere", async () => {
    const owner = await createUser();
    const { financials, rootFile } = await createRoomTree(owner.id);
    void rootFile;

    const stats = await folderStats(financials);
    expect(stats).toEqual({ folders: 1, files: 1, bytes: 200 });
  });

  it("computes whole-room totals across every folder", async () => {
    const owner = await createUser();
    const { room } = await createRoomTree(owner.id);

    const stats = await roomStats(room.id);
    expect(stats).toEqual({ folders: 3, files: 2, bytes: 300 });
  });
});

describe("share resolution", () => {
  it("returns null for an unknown token", async () => {
    expect(await resolveShareByToken("does-not-exist")).toBeNull();
  });

  it("returns null once a share has been revoked", async () => {
    const owner = await createUser();
    const { room } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-revoked",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
        revokedAt: new Date(),
      },
    });
    expect(await resolveShareByToken(share.token)).toBeNull();
  });

  it("returns null when the shared folder was deleted after the share was created", async () => {
    const owner = await createUser();
    const { room, financials } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-dangling",
        resourceType: "FOLDER",
        resourceId: financials.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });
    await db.folder.delete({ where: { id: financials.id } });
    expect(await resolveShareByToken(share.token)).toBeNull();
  });
});

describe("canUseShare", () => {
  it("lets anyone use a public share, signed in or not", async () => {
    const owner = await createUser();
    const { room } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-public",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
      include: { grants: true },
    });
    expect(canUseShare(share, null)).toBe(true);
    expect(canUseShare(share, { id: "someone-else", email: "x@test.local" })).toBe(true);
  });

  it("restricts a restricted share to the owner and invited grants only", async () => {
    const owner = await createUser();
    const invitee = await createUser({ email: "invitee@test.local" });
    const stranger = await createUser({ email: "stranger@test.local" });
    const { room } = await createRoomTree(owner.id);

    const share = await db.share.create({
      data: {
        token: "tok-restricted",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "RESTRICTED",
        createdById: owner.id,
        grants: { create: [{ email: invitee.email, userId: invitee.id }] },
      },
      include: { grants: true },
    });

    expect(canUseShare(share, owner)).toBe(true);
    expect(canUseShare(share, invitee)).toBe(true);
    expect(canUseShare(share, stranger)).toBe(false);
    expect(canUseShare(share, null)).toBe(false);
  });
});

describe("subtree containment (shareCoversFolder / shareCoversFile)", () => {
  it("a room-level share covers every folder and file in the room", async () => {
    const owner = await createUser();
    const { room, legal, auditFile } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-room",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
      include: { grants: true },
    });
    const resolved = {
      share,
      roomName: room.name,
      ownerLabel: owner.email,
      resource: { type: "ROOM" as const, roomId: room.id, name: room.name },
    };

    expect(await shareCoversFolder(resolved, legal.id)).not.toBeNull();
    expect(await shareCoversFile(resolved, auditFile)).toBe(true);
  });

  it("a folder-level share covers its descendants but not its siblings", async () => {
    const owner = await createUser();
    const { room, financials, audit, legal, auditFile, rootFile } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-folder",
        resourceType: "FOLDER",
        resourceId: financials.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
      include: { grants: true },
    });
    const resolved = {
      share,
      roomName: room.name,
      ownerLabel: owner.email,
      resource: { type: "FOLDER" as const, folder: financials },
    };

    expect(await shareCoversFolder(resolved, audit.id)).not.toBeNull();
    expect(await shareCoversFolder(resolved, legal.id)).toBeNull();
    expect(await shareCoversFile(resolved, auditFile)).toBe(true);
    expect(await shareCoversFile(resolved, rootFile)).toBe(false);
  });

  it("a file-level share covers only that exact file", async () => {
    const owner = await createUser();
    const { room, auditFile, rootFile } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-file",
        resourceType: "FILE",
        resourceId: auditFile.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
      include: { grants: true },
    });
    const resolved = {
      share,
      roomName: room.name,
      ownerLabel: owner.email,
      resource: { type: "FILE" as const, file: auditFile },
    };

    expect(await shareCoversFile(resolved, auditFile)).toBe(true);
    expect(await shareCoversFile(resolved, rootFile)).toBe(false);
  });
});

describe("canReadFile", () => {
  it("lets the owner read without any share", async () => {
    const owner = await createUser();
    const { rootFile } = await createRoomTree(owner.id);
    expect(await canReadFile(rootFile.id, { user: owner, shareToken: null })).toBe(true);
  });

  it("denies a stranger with no share token and no grant", async () => {
    const owner = await createUser();
    const stranger = await createUser({ email: "stranger2@test.local" });
    const { rootFile } = await createRoomTree(owner.id);
    expect(await canReadFile(rootFile.id, { user: stranger, shareToken: null })).toBe(false);
  });

  it("lets an anonymous visitor in through a valid public token", async () => {
    const owner = await createUser();
    const { room, rootFile } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-read",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });
    expect(
      await canReadFile(rootFile.id, { user: null, shareToken: share.token })
    ).toBe(true);
  });

  it("denies a revoked token even though it used to work", async () => {
    const owner = await createUser();
    const { room, rootFile } = await createRoomTree(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-was-valid",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });
    await db.share.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
    expect(
      await canReadFile(rootFile.id, { user: null, shareToken: share.token })
    ).toBe(false);
  });
});
