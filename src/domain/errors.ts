export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function unavailable(code = "unavailable"): never {
  throw new AppError(
    code,
    code === "consumed"
      ? "This drop has already been opened."
      : "This share has expired, been deleted, or is unavailable.",
    410,
  );
}
