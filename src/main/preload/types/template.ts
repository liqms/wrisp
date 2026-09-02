import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateResourceFile,
} from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: (type: TemplateType) => Promise<ApiResponse<TemplateFile>>;
  getBuiltIn: (
    type: TemplateType,
  ) => Promise<ApiResponse<TemplateResourceFile[]>>;
  upsertCustom: (
    type: TemplateType,
    tpl: CustomTemplate,
  ) => Promise<ApiResponse<TemplateFile>>;
  deleteCustom: (
    type: TemplateType,
    id: string,
  ) => Promise<ApiResponse<TemplateFile>>;
  setEnabled: (
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ) => Promise<ApiResponse<TemplateFile>>;
}
