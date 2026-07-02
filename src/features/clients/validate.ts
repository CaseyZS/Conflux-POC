// Pure input validation for the clients feature. No framework imports, so it
// unit-tests without a server or DB — the createClient action is a thin shell
// around this plus the guarded write.

export type ClientInput = {
  name: string;
  contactPerson: string | null;
  email: string | null;
  billingAddress: string | null;
  currency: string; // ISO-4217, normalized to uppercase
};

export type ClientFieldErrors = Partial<Record<keyof ClientInput, string>>;

export type ClientInputResult =
  | { ok: true; data: ClientInput }
  | { ok: false; errors: ClientFieldErrors };

// FormData.get() returns string | File | null; anything non-string is treated
// as absent so a crafted multipart request can't smuggle a File through.
function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

export function parseClientInput(
  raw: Record<string, unknown>,
): ClientInputResult {
  const errors: ClientFieldErrors = {};

  const name = asTrimmedString(raw.name);
  if (name === "") errors.name = "Name is required.";

  const email = emptyToNull(asTrimmedString(raw.email));
  if (email !== null && !/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const currency = asTrimmedString(raw.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "Currency must be a 3-letter code (e.g. USD).";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      name,
      contactPerson: emptyToNull(asTrimmedString(raw.contactPerson)),
      email,
      billingAddress: emptyToNull(asTrimmedString(raw.billingAddress)),
      currency,
    },
  };
}
