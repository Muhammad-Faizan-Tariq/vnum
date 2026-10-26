// Minimal typings for the untyped `smpp` package (only what VNum uses).
declare module "smpp" {
  import { EventEmitter } from "node:events";

  interface Pdu {
    command: string;
    command_status: number;
    sequence_number: number;
    source_addr?: string;
    destination_addr?: string;
    system_id?: string;
    password?: string;
    system_type?: string;
    short_message?: { message?: string } | string;
    message_payload?: { message?: string } | string;
    receipted_message_id?: string;
    response(opts?: Record<string, unknown>): Pdu;
  }

  class Session extends EventEmitter {
    remoteAddress?: string;
    bind_receiver(opts: Record<string, unknown>, cb: (pdu: Pdu) => void): void;
    deliver_sm(opts: Record<string, unknown>, cb?: (pdu: Pdu) => void): void;
    send(pdu: Pdu, cb?: (pdu: Pdu) => void): void;
    pause(): void;
    resume(): void;
    close(cb?: () => void): void;
    destroy(cb?: () => void): void;
  }

  class Server extends EventEmitter {
    listen(port: number, host?: string, cb?: () => void): void;
    close(cb?: () => void): void;
  }

  const smpp: {
    connect(options: Record<string, unknown>, listener?: () => void): Session;
    createServer(options: Record<string, unknown>, listener: (session: Session) => void): Server;
    errors: Record<string, number>;
    ESME_ROK: number;
    ESME_RBINDFAIL: number;
    ESME_RINVPASWD: number;
    ESME_RINVSYSID: number;
  };
  export default smpp;
  export type { Session, Pdu };
}
