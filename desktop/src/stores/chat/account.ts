export function accountMoved(
  before: { userId: string | null } | null,
  after: { userId: string | null },
): boolean {
  return before !== null && before.userId !== after.userId;
}
