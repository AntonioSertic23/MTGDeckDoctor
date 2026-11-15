"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Button, inputClassName } from "@/components/ui";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type DialogRequest =
  | ({ kind: "confirm"; resolve: (value: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

interface DialogApi {
  /** Resolves true when the user confirms. */
  confirm(options: ConfirmOptions): Promise<boolean>;
  /** Resolves the entered text, or null on cancel. */
  prompt(options: PromptOptions): Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error("useDialog must be used inside <DialogProvider>.");
  return api;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(DialogRequest & { id: number }) | null>(null);
  const nextId = useRef(1);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setRequest({ kind: "confirm", resolve, id: nextId.current++, ...options }),
      ),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) =>
        setRequest({ kind: "prompt", resolve, id: nextId.current++, ...options }),
      ),
    [],
  );

  const api = useMemo<DialogApi>(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request ? (
        <DialogHost
          // Fresh state (input value, focus) for every request.
          key={request.id}
          request={request}
          onDone={() => setRequest(null)}
        />
      ) : null}
    </DialogContext.Provider>
  );
}

function DialogHost({ request, onDone }: { request: DialogRequest; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(request.kind === "prompt" ? (request.defaultValue ?? "") : "");
  const settled = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function finish(accepted: boolean) {
    if (settled.current) return;
    settled.current = true;
    if (request.kind === "confirm") request.resolve(accepted);
    else request.resolve(accepted ? value.trim() : null);
    ref.current?.close();
    onDone();
  }

  const confirmLabel = request.confirmLabel ?? (request.kind === "confirm" ? "Confirm" : "Save");

  return (
    <dialog
      ref={ref}
      aria-labelledby="app-dialog-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-0 text-ink shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        finish(false);
      }}
      onClick={(event) => {
        // A click on the <dialog> element itself is a click on the backdrop.
        if (event.target === ref.current) finish(false);
      }}
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (request.kind === "prompt" && !value.trim()) return;
          finish(true);
        }}
      >
        <div className="space-y-1.5">
          <h2
            id="app-dialog-title"
            className="font-[family-name:var(--font-display)] text-lg font-semibold"
          >
            {request.title}
          </h2>
          {request.description ? (
            <p className="text-sm leading-relaxed text-muted">{request.description}</p>
          ) : null}
        </div>

        {request.kind === "prompt" ? (
          <label className="block space-y-1.5">
            {request.label ? (
              <span className="text-xs font-medium text-muted">{request.label}</span>
            ) : null}
            <input
              autoFocus
              value={value}
              placeholder={request.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onFocus={(event) => event.target.select()}
              className={inputClassName}
            />
          </label>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => finish(false)}>
            {request.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="submit"
            autoFocus={request.kind === "confirm"}
            variant={request.kind === "confirm" && request.danger ? "danger" : "primary"}
            disabled={request.kind === "prompt" && !value.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
