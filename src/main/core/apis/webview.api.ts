import { webViewService } from "../services/webview.service";
import { response } from "../../utils/response";
import { ErrorCode } from "../../../shared/enums";
import type { ApiResponse } from "../../../shared/types";

async function createWebView(url: string): Promise<ApiResponse<void>> {
    try {
        await webViewService.create(url);
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_CREATE_FAILED, error as Error);
    }
}

async function reloadWebView(): Promise<ApiResponse<void>> {
    try {
        await webViewService.reload();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_RELOAD_FAILED, error as Error);
    }
}

async function destroyWebView(): Promise<ApiResponse<void>> {
    try {
        await webViewService.destroy();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_DESTROY_FAILED, error as Error);
    }
}

async function goBack(): Promise<ApiResponse<void>> {
    try {
        await webViewService.goBack();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_GO_BACK_FAILED, error as Error);
    }
}

async function goForward(): Promise<ApiResponse<void>> {
    try {
        await webViewService.goForward();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_GO_FORWARD_FAILED, error as Error);
    }
}


export { createWebView, reloadWebView, destroyWebView, goBack, goForward }
