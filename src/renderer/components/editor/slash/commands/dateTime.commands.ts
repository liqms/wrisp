import type { CommandGroup, SlashCommand } from "./types";
import type { Editor } from "@tiptap/core";
import type { Component } from "vue";
import { TodayFilled, ChevronLeftFilled, ChevronRightFilled, AccessTimeFilled, EventFilled } from "@vicons/material";
import { deleteSlashText, formatDate, formatDateTime } from "./helpers";
import { pickDate } from "./datePicker";

function dt(
  id: string,
  title: string,
  description: string,
  icon: string | Component,
  insert: (editor: Editor, pos: number) => string | Promise<string>,
): SlashCommand {
  return {
    id,
    title,
    description,
    icon,
    action: async ({ editor, pos }) => {
      const text = await insert(editor, pos);
      if (!text) return;
      deleteSlashText(editor, pos);
      editor.chain().focus().insertContent(`[[${text}]]`).run();
    },
  };
}

export const dateTimeCommandGroup: CommandGroup = {
  id: "dateTime",
  label: "日期和时间",
  items: [
    dt("today", "今天", "插入今天日期", TodayFilled, () => formatDate(new Date())),
    dt("yesterday", "昨天", "插入昨天日期", ChevronLeftFilled, () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return formatDate(d);
    }),
    dt("tomorrow", "明天", "插入明天日期", ChevronRightFilled, () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return formatDate(d);
    }),
    dt("currentTime", "当前时间", "插入当前日期和时间", AccessTimeFilled, () => formatDateTime(new Date())),
    dt("datePicker", "日期选择", "选择自定义日期插入", EventFilled, (editor, pos) => pickDate(editor, pos)),
  ],
};
