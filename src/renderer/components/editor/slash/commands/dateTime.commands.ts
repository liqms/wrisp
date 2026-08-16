import type { CommandGroup, SlashCommand } from "./types";
import type { Editor } from "@tiptap/core";
import type { Component } from "vue";
import { TodayFilled, ChevronLeftFilled, ChevronRightFilled, AccessTimeFilled, EventFilled } from "@vicons/material";
import { deleteSlashText, formatDate, formatDateTime } from "./helpers";
import { pickDate } from "./datePicker";

/** 构建单个日期/时间命令，标题与描述使用 i18n 键翻译 */
function dt(
  t: (key: string) => string,
  id: string,
  titleKey: string,
  descKey: string,
  icon: string | Component,
  insert: (editor: Editor, pos: number) => string | Promise<string>,
): SlashCommand {
  return {
    id,
    title: t(titleKey),
    description: t(descKey),
    icon,
    action: async ({ editor, pos }) => {
      const text = await insert(editor, pos);
      if (!text) return;
      deleteSlashText(editor, pos);
      editor.chain().focus().insertContent(`[[${text}]]`).run();
    },
  };
}

/** 由 i18n 翻译函数构建日期/时间命令组 */
export function buildDateTimeGroup(t: (key: string) => string): CommandGroup {
  return {
    id: "dateTime",
    label: t("EDITOR.SLASH.DATETIME.GROUP_LABEL"),
    items: [
      dt(
        t,
        "today",
        "EDITOR.SLASH.DATETIME.TODAY_TITLE",
        "EDITOR.SLASH.DATETIME.TODAY_DESC",
        TodayFilled,
        () => formatDate(new Date()),
      ),
      dt(
        t,
        "yesterday",
        "EDITOR.SLASH.DATETIME.YESTERDAY_TITLE",
        "EDITOR.SLASH.DATETIME.YESTERDAY_DESC",
        ChevronLeftFilled,
        () => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return formatDate(d);
        },
      ),
      dt(
        t,
        "tomorrow",
        "EDITOR.SLASH.DATETIME.TOMORROW_TITLE",
        "EDITOR.SLASH.DATETIME.TOMORROW_DESC",
        ChevronRightFilled,
        () => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return formatDate(d);
        },
      ),
      dt(
        t,
        "currentTime",
        "EDITOR.SLASH.DATETIME.CURRENT_TIME_TITLE",
        "EDITOR.SLASH.DATETIME.CURRENT_TIME_DESC",
        AccessTimeFilled,
        () => formatDateTime(new Date()),
      ),
      dt(
        t,
        "datePicker",
        "EDITOR.SLASH.DATETIME.DATE_PICKER_TITLE",
        "EDITOR.SLASH.DATETIME.DATE_PICKER_DESC",
        EventFilled,
        (editor, pos) => pickDate(editor, pos, t("EDITOR.SLASH.DATETIME.DATE_PICKER_PLACEHOLDER")),
      ),
    ],
  };
}
