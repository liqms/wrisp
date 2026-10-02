/**
 * 把打回理由组织为"局部修正"指令。
 *
 * 明确要求**只改被点名之处**——避免模型借机整段重写，
 * 把已经被用户认可的部分一起改掉。打回是可逆的：应当是对症修补，
 * 而不是推倒重来（spec §6.1「打回可逆」）。
 *
 * 无有效问题时返回空串：没有任何可修之处，就不该触发一次重写。
 */
export function buildRevisionInstruction(issues: string[]): string {
  const unique = [...new Set(issues.map((i) => i.trim()).filter(Boolean))];
  if (unique.length === 0) return "";

  const list = unique.map((i) => `- ${i}`).join("\n");
  return [
    "请仅修改以下问题，其余内容保持不变：",
    list,
    "不要重写未被提到的部分。",
  ].join("\n");
}
