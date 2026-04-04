import WebViewService from "@/main/core/services/webview.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";

async function createWebView(url: string, window: Electron.BrowserWindow): Promise<ApiResponse<void>> {
    try {
        const webViewService = WebViewService.getInstance(window);
        await webViewService.create(url);
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_CREATE_FAILED, error as Error);
    }
}

async function reloadWebView(window: Electron.BrowserWindow): Promise<ApiResponse<void>> {
    try {
        const webViewService = WebViewService.getInstance(window);
        await webViewService.reload();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_RELOAD_FAILED, error as Error);
    }
}

async function destroyWebView(window: Electron.BrowserWindow): Promise<ApiResponse<void>> {
    try {
        const webViewService = WebViewService.getInstance(window);
        await webViewService.destroy();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_DESTROY_FAILED, error as Error);
    }
}

async function goBack(window: Electron.BrowserWindow): Promise<ApiResponse<void>> {
    try {
        const webViewService = WebViewService.getInstance(window);
        await webViewService.goBack();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_GO_BACK_FAILED, error as Error);
    }
}

async function goForward(window: Electron.BrowserWindow): Promise<ApiResponse<void>> {
    try {
        const webViewService = WebViewService.getInstance(window);
        await webViewService.goForward();
        return response.empty();
    } catch (error) {
        return response.error(ErrorCode.WEBVIEW_GO_FORWARD_FAILED, error as Error);
    }
}


export { createWebView, reloadWebView, destroyWebView, goBack, goForward }
