import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { formatRbnt } from "./utils";

export type FriendlyError = {
  /** Short headline shown in bold. */
  title: string;
  /** One or two sentences explaining what to do next. */
  detail: string;
  /** True when the user simply cancelled — shown calmly, not as a red error. */
  benign: boolean;
  /** True when retrying the same action could plausibly succeed. */
  retryable: boolean;
};

/**
 * Turn any thrown wallet/RPC/contract error into something a human can act on.
 *
 * Every branch here maps to a real failure that was exercised during development:
 * user rejection, each custom contract revert, insufficient funds, RPC failure,
 * and wrong network.
 */
export function toFriendlyError(error: unknown): FriendlyError {
  if (!error) {
    return {
      title: "Something went wrong",
      detail: "An unknown error occurred. Please try again.",
      benign: false,
      retryable: true,
    };
  }

  // --- User cancelled in the wallet -----------------------------------
  if (
    error instanceof UserRejectedRequestError ||
    (error instanceof BaseError && error.walk((e) => e instanceof UserRejectedRequestError))
  ) {
    return {
      title: "Transaction cancelled",
      detail: "You rejected the request in your wallet. Nothing was sent and no funds moved.",
      benign: true,
      retryable: true,
    };
  }

  const message = extractMessage(error);

  // --- Contract custom errors -------------------------------------------
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined;

    const errorName = revert?.data?.errorName;
    const args = (revert?.data?.args ?? []) as readonly unknown[];

    switch (errorName) {
      case "NotVerifiedOnRedbelly":
        return {
          title: "Wallet not verified on Redbelly",
          detail:
            "This wallet has not completed Redbelly identity verification, so the contract " +
            "rejected the mint. Complete verification, then try again.",
          benign: false,
          retryable: false,
        };

      case "ExceedsMaxSupply": {
        const remaining = args[1] as bigint | undefined;
        return {
          title: "Not enough supply left",
          detail:
            remaining !== undefined
              ? `Only ${remaining.toString()} left in the collection. Reduce your quantity and try again.`
              : "The quantity you requested exceeds the remaining supply.",
          benign: false,
          retryable: true,
        };
      }

      case "ExceedsWalletLimit": {
        const allowance = args[1] as bigint | undefined;
        return {
          title: "Wallet limit reached",
          detail:
            allowance !== undefined && allowance > 0n
              ? `This wallet can mint ${allowance.toString()} more. Reduce your quantity and try again.`
              : "This wallet has already minted its maximum allowance for this collection.",
          benign: false,
          retryable: allowance !== undefined && allowance > 0n,
        };
      }

      case "IncorrectPayment": {
        const required = args[0] as bigint | undefined;
        return {
          title: "Incorrect payment amount",
          detail:
            required !== undefined
              ? `This mint requires exactly ${formatRbnt(required)} RBNT. Please retry.`
              : "The payment amount did not match the required mint cost.",
          benign: false,
          retryable: true,
        };
      }

      case "EnforcedPause":
        return {
          title: "Minting is closed",
          detail: "Minting is currently paused for this collection. Please check back later.",
          benign: false,
          retryable: false,
        };

      case "ZeroQuantity":
        return {
          title: "Choose a quantity",
          detail: "Select at least one NFT to mint.",
          benign: false,
          retryable: true,
        };
    }
  }

  // --- Insufficient balance ----------------------------------------------
  if (
    /insufficient funds/i.test(message) ||
    /exceeds the balance/i.test(message) ||
    /gas \* price \+ value/i.test(message)
  ) {
    return {
      title: "Insufficient RBNT",
      detail:
        "This wallet does not have enough RBNT to cover the mint plus network gas. " +
        "Top up and try again.",
      benign: false,
      retryable: true,
    };
  }

  // --- Wrong network ------------------------------------------------------
  if (/chain (mismatch|not configured)/i.test(message) || /unsupported chain/i.test(message)) {
    return {
      title: "Wrong network",
      detail: "Your wallet is on a different network. Switch to Redbelly Mainnet and try again.",
      benign: false,
      retryable: true,
    };
  }

  // --- RPC / connectivity --------------------------------------------------
  if (
    /fetch failed|network error|timeout|timed out|ECONNREFUSED|502|503|504/i.test(message) ||
    /HTTP request failed/i.test(message)
  ) {
    return {
      title: "Network connection problem",
      detail:
        "We could not reach the Redbelly network. This is usually temporary — " +
        "check your connection and try again.",
      benign: false,
      retryable: true,
    };
  }

  // --- Nonce / replacement ------------------------------------------------
  if (/nonce too low|replacement transaction underpriced|already known/i.test(message)) {
    return {
      title: "Pending transaction conflict",
      detail:
        "Your wallet already has a transaction in flight. Wait for it to finish, " +
        "or speed it up in your wallet, then try again.",
      benign: false,
      retryable: true,
    };
  }

  // --- Fallback -------------------------------------------------------------
  return {
    title: "Transaction failed",
    detail: trimMessage(message) || "An unexpected error occurred. Please try again.",
    benign: false,
    retryable: true,
  };
}

function extractMessage(error: unknown): string {
  if (error instanceof BaseError) return `${error.shortMessage} ${error.details ?? ""}`.trim();
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

/** Keep fallback messages short enough to read in a toast. */
function trimMessage(message: string, max = 180): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > max ? `${firstLine.slice(0, max)}…` : firstLine;
}
