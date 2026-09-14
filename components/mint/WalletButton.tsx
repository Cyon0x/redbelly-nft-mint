"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { AlertTriangle, LogOut, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNetwork } from "@/lib/hooks/useMint";
import { activeChain } from "@/lib/chains";
import { cn, truncateAddress } from "@/lib/utils";
import { toFriendlyError } from "@/lib/errors";

/**
 * Wallet button covering every connection state:
 * disconnected → connecting → wrong network → connected.
 */
export function WalletButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { isWrongNetwork, isSwitching, switchToRedbelly } = useNetwork();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // De-duplicate connectors: several injected wallets can report the same name.
  const uniqueConnectors = connectors.filter(
    (c, i, arr) => arr.findIndex((x) => x.name === c.name) === i,
  );

  async function handleConnect(connectorUid: string) {
    const connector = connectors.find((c) => c.uid === connectorUid);
    if (!connector) return;
    setConnectError(null);
    try {
      await connectAsync({ connector });
      setPickerOpen(false);
    } catch (err) {
      const friendly = toFriendlyError(err);
      // A user closing the wallet popup is not an error worth shouting about.
      setConnectError(friendly.benign ? null : friendly.detail);
      if (friendly.benign) setPickerOpen(false);
    }
  }

  // --- Wrong network -------------------------------------------------
  if (isConnected && isWrongNetwork) {
    return (
      <Button
        variant="danger"
        onClick={switchToRedbelly}
        loading={isSwitching}
        className={className}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {isSwitching ? "Switching…" : "Switch to Redbelly"}
      </Button>
    );
  }

  // --- Connected ------------------------------------------------------
  if (isConnected && address) {
    return (
      <div className={cn("relative", className)} ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl",
            "border border-rb-border-strong bg-rb-surface px-4 font-mono text-sm text-rb-ink",
            "transition-colors hover:border-rb-red",
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-rb-success" aria-hidden="true" />
          {truncateAddress(address)}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className={cn(
              "absolute right-0 z-50 mt-2 w-56 rounded-xl border border-rb-border",
              "bg-rb-surface p-1.5 shadow-lg",
            )}
          >
            <div className="px-3 py-2">
              <p className="rb-eyebrow">Connected to</p>
              <p className="mt-0.5 text-sm font-medium text-rb-ink">{activeChain.name}</p>
            </div>
            <hr className="my-1 border-rb-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                "text-rb-ink-soft transition-colors hover:bg-rb-bg-alt hover:text-rb-danger",
              )}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Disconnected ----------------------------------------------------
  return (
    <>
      <Button onClick={() => setPickerOpen(true)} loading={isPending} className={className}>
        <Wallet className="h-4 w-4" aria-hidden="true" />
        Connect Wallet
      </Button>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-picker-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="rb-card w-full max-w-sm p-5 rb-animate-in">
            <div className="flex items-start justify-between">
              <div>
                <h2 id="wallet-picker-title" className="text-lg font-bold text-rb-ink">
                  Connect a wallet
                </h2>
                <p className="mt-1 text-sm text-rb-muted">
                  Connect an EVM wallet to mint on {activeChain.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1.5 text-rb-muted hover:bg-rb-bg-alt"
                aria-label="Close wallet picker"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {uniqueConnectors.length === 0 && (
                <p className="rounded-lg bg-rb-warning-bg p-3 text-sm text-rb-warning">
                  No EVM wallet detected. Install MetaMask or another browser wallet to
                  continue.
                </p>
              )}
              {uniqueConnectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  onClick={() => handleConnect(connector.uid)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-rb-border",
                    "bg-rb-bg-alt px-4 py-3.5 text-left transition-colors",
                    "hover:border-rb-red hover:bg-rb-red-tint",
                  )}
                >
                  <Wallet className="h-5 w-5 text-rb-red" aria-hidden="true" />
                  <span className="font-semibold text-rb-ink">{connector.name}</span>
                </button>
              ))}
            </div>

            {connectError && (
              <p role="alert" className="mt-4 rounded-lg bg-rb-danger-bg p-3 text-sm text-rb-danger">
                {connectError}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
