import zhCNMessages from "@/shared/i18n/locales/zhCN";
import enUSMessages from "@/shared/i18n/locales/enUS";
import { configService } from "@/main/core/services/config.service";

const messages: Record<string, Record<string, any>> = {
  zhCN: zhCNMessages,
  enUS: enUSMessages,
};

function getByPath(obj: any, path: string): string {
  const keys = path.split(".");
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === "object" && key in result) {
      result = result[key];
    } else {
      return path;
    }
  }
  return typeof result === "string" ? result : path;
}

/**
 * 根据当前语言设置获取本地化文案
 * @param key 点号分隔的多语言键路径，例如 "NOTIFICATION.MODEL_DOWNLOAD_SUCCESS"
 * @returns 本地化文案，未找到时返回 key 本身
 */
export function t(key: string): string {
  const locale = configService.getValue<string>("general.locale") || "zhCN";
  const lang = locale === "zhCN" ? "zhCN" : "enUS";
  return getByPath(messages[lang], key);
}