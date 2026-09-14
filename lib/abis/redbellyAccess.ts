/**
 * ABI for the Redbelly Access identity registry.
 *
 * Only `isAllowed` is needed — it is the single read that determines whether a
 * wallet has completed Redbelly identity verification.
 */
export const redbellyAccessAbi = [
  {
    inputs: [{ internalType: "address", name: "_address", type: "address" }],
    name: "isAllowed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
