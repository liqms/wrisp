import { createApp, h } from "vue";
import { NDatePicker, NConfigProvider, darkTheme } from "naive-ui";
import type { Editor } from "@tiptap/core";
import { formatDate } from "./helpers";

/**
 * 直接在光标附近弹出 Naive UI 的 Date Picker，选中日期后立即返回
 * 选中日期的字符串（YYYY-MM-DD），未选择（点击外部）时返回空字符串。
 */
export function pickDate(editor: Editor, pos: number): Promise<string> {
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
      resolve(value);
      app.unmount();
      container.remove();
    };

    const isDark = () =>
      document.documentElement.getAttribute("data-theme") === "dark";

    const App = {
      setup() {
        return () =>
          h(NConfigProvider, { theme: isDark() ? darkTheme : null }, {
            default: () =>
              h(NDatePicker, {
                type: "date",
                style: { width: "230px" },
                placeholder: "选择日期",
                autofocus: true,
                "on-update:value": (v: number | null) =>
                  finish(v ? formatDate(new Date(v)) : ""),
                "on-blur": () => finish(""),
              }),
          });
      },
    };

    const app = createApp(App);
    app.mount(container);
  });
}
