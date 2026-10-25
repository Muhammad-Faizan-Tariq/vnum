import type { PaymentMethod } from "@/generated/prisma/enums";

export type PaymentMethodInfo = {
  id: PaymentMethod;
  label: string;
  symbol: string;
  network: string;
  /** Fixed simulation rate, USD per 1 unit. Not a market price. */
  rateUsd: number;
  decimals: number;
  note: string;
};

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodInfo> = {
  BTC_SIM: {
    id: "BTC_SIM",
    label: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin (simulated)",
    rateUsd: 65000,
    decimals: 8,
    note: "Fixed rate of 1 BTC = $65,000 for the simulation.",
  },
  USDT_TRC20_SIM: {
    id: "USDT_TRC20_SIM",
    label: "Tether USDT",
    symbol: "USDT",
    network: "TRON TRC-20 (simulated)",
    rateUsd: 1,
    decimals: 2,
    note: "Pegged 1:1 to USD in the simulation.",
  },
  USDT_ERC20_SIM: {
    id: "USDT_ERC20_SIM",
    label: "Tether USDT",
    symbol: "USDT",
    network: "Ethereum ERC-20 (simulated)",
    rateUsd: 1,
    decimals: 2,
    note: "Pegged 1:1 to USD in the simulation.",
  },
};

export const PAYMENT_METHOD_LIST = Object.values(PAYMENT_METHODS);
