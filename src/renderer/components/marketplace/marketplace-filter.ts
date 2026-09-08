import { LOCALE } from "@/shared/enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

export interface MarketplaceFilter {
  keyword: string;
  /** 当前语言解析后的标签（'' = 全部） */
  tag: string;
  locale: string;
}

/**
 * 市场列表筛选：按当前语言标题关键词匹配，并按当前语言标签过滤。
 * 纯函数，便于单测。
 */
export function filterMarketplace(
  list: MarketplaceItem[],
  f: MarketplaceFilter,
): MarketplaceItem[] {
  const useEn = f.locale === LOCALE.EN;
  const kw = f.keyword.trim().toLowerCase();
  return list.filter((item) => {
    if (f.tag) {
      const hasTag = item.tags.some((tg) => (useEn ? tg.en : tg.zh) === f.tag);
      if (!hasTag) return false;
    }
    if (!kw) return true;
    const title = (useEn ? item.title.en : item.title.zh).toLowerCase();
    return title.includes(kw);
  });
}