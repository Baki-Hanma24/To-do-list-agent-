export function idParam(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
export const badRequest = (error: string) => Response.json({ error }, { status: 400 });
