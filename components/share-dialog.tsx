"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Globe, Link2, Lock, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import type { ShareResource, ShareState } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const RESOURCE_LABEL = {
  ROOM: "data room",
  FOLDER: "folder",
  FILE: "file",
} as const;

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ShareResource;
  ownerEmail: string;
};

export function ShareDialog(props: ShareDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <ShareDialogBody {...props} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted fresh each time the dialog opens, so state starts clean. */
function ShareDialogBody({ onOpenChange, resource, ownerEmail }: ShareDialogProps) {
  const [state, setState] = useState<ShareState | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [switchingAccess, setSwitchingAccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const query = `resourceType=${resource.type}&resourceId=${resource.id}`;

  const refresh = useCallback(async () => {
    setState(await api<ShareState>(`/api/shares?${query}`));
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    api<ShareState>(`/api/shares?${query}`)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        toast.error("Couldn't load sharing settings. Try again.");
        onOpenChange(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, onOpenChange]);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const emails = email
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!emails.length) return;

    setInviting(true);
    try {
      await api("/api/shares", {
        method: "POST",
        json: {
          action: "invite",
          resourceType: resource.type,
          resourceId: resource.id,
          emails,
        },
      });
      setEmail("");
      await refresh();
      toast.success(
        emails.length === 1 ? `Invited ${emails[0]}` : `Invited ${emails.length} people`
      );
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setInviting(false);
    }
  }

  async function removeGrant(grantId: string, grantEmail: string) {
    if (!state?.restricted) return;
    try {
      await api(`/api/shares/${state.restricted.id}/grants/${grantId}`, {
        method: "DELETE",
      });
      await refresh();
      toast.success(`Removed access for ${grantEmail}`);
    } catch {
      toast.error("Couldn't remove access. Try again.");
    }
  }

  async function setGeneralAccess(value: "restricted" | "public") {
    setSwitchingAccess(true);
    try {
      if (value === "public") {
        await api("/api/shares", {
          method: "POST",
          json: {
            action: "enable_public",
            resourceType: resource.type,
            resourceId: resource.id,
          },
        });
        toast.success("Anyone with the link can now view");
      } else if (state?.public) {
        await api(`/api/shares/${state.public.id}`, { method: "DELETE" });
        toast.success("Link access turned off");
      }
      await refresh();
    } catch {
      toast.error("Couldn't update link access. Try again.");
    } finally {
      setSwitchingAccess(false);
    }
  }

  const shareToken = state?.public?.token ?? state?.restricted?.token ?? null;

  async function copyLink() {
    if (!shareToken) return;
    await navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-6 truncate">Share “{resource.name}”</DialogTitle>
        <DialogDescription>
          People you share this {RESOURCE_LABEL[resource.type]} with can view
          {resource.type === "FILE" ? " it" : " everything inside it"}, but not
          change anything.
        </DialogDescription>
      </DialogHeader>

        {state === null ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        ) : (
          <div className="space-y-5">
            <form onSubmit={invite} className="flex gap-2">
              <Input
                type="text"
                inputMode="email"
                placeholder="Invite by email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email addresses to invite"
              />
              <Button type="submit" disabled={inviting || !email.trim()}>
                {inviting ? "Inviting…" : "Invite"}
              </Button>
            </form>

            <ul className="space-y-1">
              <li className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
                <span className="truncate">{ownerEmail}</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </li>
              {state.restricted?.grants.map((grant) => (
                <li
                  key={grant.id}
                  className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate">{grant.email}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Viewer</span>
                    <button
                      onClick={() => removeGrant(grant.id, grant.email)}
                      className="rounded p-0.5 text-muted-foreground transition-opacity hover:text-destructive focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      aria-label={`Remove access for ${grant.email}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
              {!state.restricted?.grants.length && (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">
                  No one has been invited yet.
                </li>
              )}
            </ul>

            <Separator />

            <div className="space-y-2">
              <label htmlFor="general-access" className="text-sm font-medium">
                General access
              </label>
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                  {state.public ? (
                    <Globe className="size-4 text-primary" />
                  ) : (
                    <Lock className="size-4 text-muted-foreground" />
                  )}
                </span>
                <Select
                  value={state.public ? "public" : "restricted"}
                  onValueChange={(v) => setGeneralAccess(v as "restricted" | "public")}
                  disabled={switchingAccess}
                >
                  <SelectTrigger id="general-access" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restricted">
                      Restricted — only people invited above
                    </SelectItem>
                    <SelectItem value="public">
                      Anyone with the link — view only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              {shareToken ? (
                <Button variant="outline" onClick={copyLink} className="gap-2">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              ) : (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link2 className="size-3.5" />
                  Invite someone or turn on link access to get a link.
                </p>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
    </>
  );
}
