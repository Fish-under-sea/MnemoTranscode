/**
 * 用户主动切换方案时会 bump 代数；在途的「被动拉取 /auth/subscription」若返回时
 * 代数已变，应丢弃，避免把刚写入的 Pro 用更早发出的 GET 的 Free 结果覆盖掉。
 */
let subscriptionSyncGen = 0

export function bumpSubscriptionSyncGen(): void {
  subscriptionSyncGen += 1
}

export function getSubscriptionSyncGen(): number {
  return subscriptionSyncGen
}
