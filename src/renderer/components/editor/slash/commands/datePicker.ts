import { createApp, h, unref } from "vue";
import {
  NDatePicker,
  NConfigProvider,
  darkTheme,
  zhCN,
  dateZhCN,
  enUS,
  dateEnUS,
} from "naive-ui";
import type { Editor } from "@tiptap/core";
import { formatDate } from "./helpers";
import { i18n } from "@/renderer/plugins/i18n";
import { LOCALE } from "@/shared/enums";

/**
 * 直接在光标附近弹出 Naive UI 的 Date Picker，选中日期后立即返回
 * 选中日期的字符串（YYYY-MM-DD），未选择（点击弹窗外部）时返回空字符串。
 * 面板文案（月份、星期、按钮等）跟随应用语言设置（中/英自动适配）。
 */
// i18n 实例为联合类型，此处收敛为简单的 t(key) 签名
const t = i18n.global.t as (key: string) => string;

export function pickDate(
  editor: Editor,
  pos: number,
  placeholder = t("EDITOR.SLASH.DATETIME.DATE_PICKER_PLACEHOLDER"),
): Promise<string> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    container.style.position = "fixed";
    container.style.zIndex = "99999";

    // 定位到光标下方
    const coords = editor.view.coordsAtPos(pos);
    container.style.left = `${coords.left}px`;
    container.style.top = `${coords.bottom + 4}px`;

    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("pointerdown", onPointerDown, true);
      resolve(value);
      app.unmount();
      container.remove();
    };

    // 点击弹窗外部区域时关闭弹窗
    const onPointerDown = (e: PointerEvent) => {
      if (container.contains(e.target as Node)) return;
      finish("");
    };

    // 延迟注册，避免触发弹窗的那次点击立即把它关掉
    setTimeout(() => {
      if (!settled) {
        document.addEventListener("pointerdown", onPointerDown, true);
      }
    }, 0);

    const isDark = () =>
      document.documentElement.getAttribute("data-theme") === "dark";

    // 面板语言跟随应用语言设置（与 App.vue 的全局配置保持一致）
    const isZh = unref(i18n.global.locale) === LOCALE.ZH;

    const App = {
      setup() {
        return () =>
          h(
            NConfigProvider,
            {
              theme: isDark() ? darkTheme : null,
              locale: isZh ? zhCN : enUS,
              dateLocale: isZh ? dateZhCN : dateEnUS,
            },
            {
              default: () =>
                h(NDatePicker, {
                  type: "date",
                  placeholder,
                  panel: true,
                  "on-update:value": (v: number | null) =>
                    finish(v ? formatDate(new Date(v)) : ""),
                }),
            },
          );
      },
    };

    const app = createApp(App);
    app.mount(container);
  });
}
