import type { ApiResponse } from "@/shared/types";
import type {
  CustomTemplate,
  TemplateFile,
} from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: () => Promise<ApiResponse<TemplateFile>>;
  upsertCustom: (
    tpl: CustomTemplate,
  ) => Promise<ApiResponse<TemplateFile>>;
  deleteCustom: (id: string) => Promise<ApiResponse<TemplateFile>>;
  setEnabled: (
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ) => Promise<ApiResponse<TemplateFile>>;
}
