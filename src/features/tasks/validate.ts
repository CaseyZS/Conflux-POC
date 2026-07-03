// Pure input validation for the tasks feature. No framework imports, so it
// unit-tests without a server or DB — the actions are thin shells around this
// plus the guarded write.

export type TaskInput = {
  name: string;
  defaultBillable: boolean;
};

export type TaskFieldErrors = Partial<Record<"name", string>>;

export type TaskInputResult =
  | { ok: true; data: TaskInput }
  | { ok: false; errors: TaskFieldErrors };

export function parseTaskInput(raw: Record<string, unknown>): TaskInputResult {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name === "") return { ok: false, errors: { name: "Name is required." } };

  // Checkbox semantics: browsers submit the field only while checked, so
  // presence means true and absence means false — the value itself ("on")
  // carries no information.
  return {
    ok: true,
    data: { name, defaultBillable: raw.defaultBillable != null },
  };
}
