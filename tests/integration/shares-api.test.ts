import { describe, expect, it } from "vitest";
import { GET as getShares, POST as mutateShares } from "@/app/api/shares/route";
import { DELETE as revokeShare } from "@/app/api/shares/[shareId]/route";
import { DELETE as revokeGrant } from "@/app/api/shares/[shareId]/grants/[grantId]/route";
import { db } from "@/lib/db";
import { createUser, jsonRequest, params, signInAs } from "./helpers";

async function makeRoom(ownerId: string) {
  return db.dataRoom.create({ data: { name: "Neptune", ownerId } });
}

function query(resourceType: string, resourceId: string) {
  return `resourceType=${resourceType}&resourceId=${resourceId}`;
}

describe("POST /api/shares (enable_public)", () => {
  it("creates a public share for a room the caller owns", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const res = await mutateShares(
      jsonRequest("http://t/api/shares", "POST", {
        action: "enable_public",
        resourceType: "ROOM",
        resourceId: room.id,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();

    const state = await getShares(
      new Request(`http://t/api/shares?${query("ROOM", room.id)}`)
    );
    expect((await state.json()).public.token).toBe(body.token);
  });

  it("is idempotent: enabling public twice reuses the same share", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    const body = { action: "enable_public", resourceType: "ROOM", resourceId: room.id };

    const first = await mutateShares(jsonRequest("http://t/api/shares", "POST", body));
    const second = await mutateShares(jsonRequest("http://t/api/shares", "POST", body));
    expect((await first.json()).token).toBe((await second.json()).token);
    expect(await db.share.count({ where: { roomId: room.id, mode: "PUBLIC" } })).toBe(1);
  });

  it("refuses to share a resource the caller does not own", async () => {
    const owner = await createUser();
    const attacker = await createUser({ email: "attacker@test.local" });
    const room = await makeRoom(owner.id);
    signInAs(attacker);

    const res = await mutateShares(
      jsonRequest("http://t/api/shares", "POST", {
        action: "enable_public",
        resourceType: "ROOM",
        resourceId: room.id,
      })
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/shares (invite)", () => {
  it("invites an email that has no account yet", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const res = await mutateShares(
      jsonRequest("http://t/api/shares", "POST", {
        action: "invite",
        resourceType: "ROOM",
        resourceId: room.id,
        emails: ["future-user@test.local"],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.grants).toEqual([expect.objectContaining({ email: "future-user@test.local" })]);

    const grant = await db.shareGrant.findFirstOrThrow({ where: { email: "future-user@test.local" } });
    expect(grant.userId).toBeNull();
  });

  it("links the grant to an existing user by email", async () => {
    const owner = await createUser();
    const invitee = await createUser({ email: "invitee@test.local" });
    const room = await makeRoom(owner.id);
    signInAs(owner);

    await mutateShares(
      jsonRequest("http://t/api/shares", "POST", {
        action: "invite",
        resourceType: "ROOM",
        resourceId: room.id,
        emails: [invitee.email],
      })
    );
    const grant = await db.shareGrant.findFirstOrThrow({ where: { email: invitee.email } });
    expect(grant.userId).toBe(invitee.id);
  });

  it("rejects inviting the owner's own email", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);

    const res = await mutateShares(
      jsonRequest("http://t/api/shares", "POST", {
        action: "invite",
        resourceType: "ROOM",
        resourceId: room.id,
        emails: [owner.email],
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/shares/:shareId (revoke)", () => {
  it("marks the share revoked so it stops resolving", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    const share = await db.share.create({
      data: {
        token: "tok-x",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });

    const res = await revokeShare(
      jsonRequest(`http://t/api/shares/${share.id}`, "DELETE"),
      params({ shareId: share.id })
    );
    expect(res.status).toBe(200);
    expect((await db.share.findUniqueOrThrow({ where: { id: share.id } })).revokedAt).not.toBeNull();
  });

  it("refuses to revoke a share belonging to someone else's room", async () => {
    const owner = await createUser();
    const attacker = await createUser({ email: "attacker2@test.local" });
    const room = await makeRoom(owner.id);
    const share = await db.share.create({
      data: {
        token: "tok-y",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "PUBLIC",
        createdById: owner.id,
      },
    });

    signInAs(attacker);
    const res = await revokeShare(
      jsonRequest(`http://t/api/shares/${share.id}`, "DELETE"),
      params({ shareId: share.id })
    );
    expect(res.status).toBe(404);
    expect((await db.share.findUniqueOrThrow({ where: { id: share.id } })).revokedAt).toBeNull();
  });
});

describe("DELETE /api/shares/:shareId/grants/:grantId", () => {
  it("removes a single person's access without affecting others", async () => {
    const owner = await createUser();
    const room = await makeRoom(owner.id);
    signInAs(owner);
    const share = await db.share.create({
      data: {
        token: "tok-z",
        resourceType: "ROOM",
        resourceId: room.id,
        roomId: room.id,
        mode: "RESTRICTED",
        createdById: owner.id,
        grants: {
          create: [{ email: "a@test.local" }, { email: "b@test.local" }],
        },
      },
      include: { grants: true },
    });
    const [grantA] = share.grants;

    const res = await revokeGrant(
      jsonRequest(`http://t/api/shares/${share.id}/grants/${grantA.id}`, "DELETE"),
      params({ shareId: share.id, grantId: grantA.id })
    );
    expect(res.status).toBe(200);

    const remaining = await db.shareGrant.findMany({ where: { shareId: share.id } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe("b@test.local");
  });
});
