export function GET(): Response {
  return Response.json({
    ok: true,
    data: { status: "up", time: new Date().toISOString() },
  });
}
