"use client";

import { useRef, useState } from "react";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type NameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  submitLabel: string;
  initialValue?: string;
  /** Select the name without its extension, like Finder does on rename. */
  selectBaseName?: boolean;
  onSubmit: (name: string) => Promise<void>;
};

/**
 * One dialog for every "give it a name" flow: new room, new folder, rename.
 * Server-side name conflicts (409) surface inline instead of a toast so the
 * user can fix the name without losing context. The form state lives in an
 * inner component that mounts fresh each time the dialog opens.
 */
export function NameDialog(props: NameDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <NameForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  onOpenChange,
  title,
  description,
  label = "Name",
  submitLabel,
  initialValue = "",
  selectBaseName = false,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    if (!selectBaseName) {
      event.target.select();
      return;
    }
    const dot = initialValue.lastIndexOf(".");
    event.target.setSelectionRange(0, dot > 0 ? dot : initialValue.length);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const name = value.trim();
    if (!name) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(name);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Something went wrong. Try again."
      );
      setPending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Input
            ref={inputRef}
            aria-label={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={handleFocus}
            autoFocus
            maxLength={255}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !value.trim()}>
            {pending ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
