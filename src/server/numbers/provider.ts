import type { VirtualNumber } from "@/generated/prisma/client";

/**
 * Number provisioning is isolated behind this interface. The only implementation shipped is the
 * demo adapter over seeded inventory; a real carrier/aggregator adapter would implement the same
 * contract (reserve upstream, activate after payment, release on cancellation).
 */
export interface NumberProvider {
  readonly id: string;
  readonly label: string;
  /** True when numbers from this provider are test data and not live on any telecom network. */
  readonly simulated: boolean;
  /** Called once an order is paid; resolves when the number is ready to use. */
  activate(number: Pick<VirtualNumber, "id" | "e164">, orderReference: string): Promise<{ activatedAt: Date }>;
  /** Called when a paid-for or reserved number is returned to inventory. */
  release(number: Pick<VirtualNumber, "id" | "e164">, orderReference: string): Promise<void>;
}

class DemoNumberProvider implements NumberProvider {
  readonly id = "demo";
  readonly label = "VNum demo inventory";
  readonly simulated = true;
  async activate() {
    return { activatedAt: new Date() };
  }
  async release() {}
}

const registry: Record<string, NumberProvider> = { demo: new DemoNumberProvider() };

export function getNumberProvider(id: string): NumberProvider {
  const p = registry[id];
  if (!p) throw new Error(`No number provider registered for "${id}"`);
  return p;
}
