import WebViewService from "@/main/core/services/webview.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  ApiResponse,
  NavigationState,
  WebContentViewOptions,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function createWebView(
  url: string,
  window: Electron.BrowserWindow,
  options?: WebContentViewOptions,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.create(url, options);
    return response.empty();
  } catch (error) {
    Logger.error("创建 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_CREATE_FAILED, error as Error);
  }
}

async function reloadWebView(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.reload();
    return response.empty();
  } catch (error) {
    Logger.error("重新加载 WebView API 调用失败", {
      error: JSON.stringify(error),
    });
    return response.error(ErrorCode.WEBVIEW_RELOAD_FAILED, error as Error);
  }
}

async function destroyWebView(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.destroy();
    return response.empty();
  } catch (error) {
    Logger.error("销毁 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_DESTROY_FAILED, error as Error);
  }
}
async function hideWebView(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.hide();
    return response.empty();
  } catch (error) {
    Logger.error("隐藏 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_HIDE_FAILED, error as Error);
  }
}

async function resizeWebView(
  window: Electron.BrowserWindow,
  options: WebContentViewOptions,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.resize(options);
    return response.empty();
  } catch (error) {
    Logger.error("调整 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_RESIZE_FAILED, error as Error);
  }
}

async function goBack(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.goBack();
    return response.empty();
  } catch (error) {
    Logger.error("返回 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_GO_BACK_FAILED, error as Error);
  }
}

async function goForward(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<void>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    await webViewService.goForward();
    return response.empty();
  } catch (error) {
    Logger.error("前进 WebView API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WEBVIEW_GO_FORWARD_FAILED, error as Error);
  }
}

async function getNavigationState(
  window: Electron.BrowserWindow,
): Promise<ApiResponse<NavigationState>> {
  try {
    const webViewService = WebViewService.getInstance(window);
    const navigationState = webViewService.getNavigationState();
    return response.success(navigationState);
  } catch (error) {
    Logger.error("获取 WebView 导航状态 API 调用失败", {
      error: JSON.stringify(error),
    });
    return response.error(
      ErrorCode.WEBVIEW_GET_NAVIGATION_STATE_FAILED,
      error as Error,
    );
  }
}

export {
  createWebView,
  reloadWebView,
  destroyWebView,
  hideWebView,
  resizeWebView,
  goBack,
  goForward,
  getNavigationState,
};
