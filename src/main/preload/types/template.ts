import type { ApiResponse } from "@/shared/types";
import type {
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: () => Promise<ApiResponse<SlashTemplateFile>>;
  upsertCustom: (
    tpl: CustomTemplate,
  ) => Promise<ApiResponse<SlashTemplateFile>>;
  deleteCustom: (id: string) => Promise<ApiResponse<SlashTemplateFile>>;
  setEnabled: (
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ) => Promise<ApiResponse<SlashTemplateFile>>;
}
