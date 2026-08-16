/**
 * 菜单和新建立类型定义
 */

import type { Component } from 'vue'
import {
  ChatbubbleEllipses,
  ClipboardOutline,
  ImagesOutline,
  JournalOutline
} from '@vicons/ionicons5'

export enum MenuActionType {
  ROUTE = 'route',
  WEBVIEW = 'webview',
  PARAM = 'param'
}

export interface MenuItem {
  key: string
  label: string
  icon?: Component
  actionType: MenuActionType
  action: string
  isVisible?: boolean
}

export interface NewOption {
  key: string
  label: string
  icon?: Component
  actionType: MenuActionType
  action: string
  isVisible?: boolean
}

export const DEMO_MENU_ITEMS: MenuItem[] = [
  {
    key: 'flashcards',
    label: 'APP.CONTENT_TYPE.FLASHCARD',
    icon: ClipboardOutline,
    actionType: MenuActionType.ROUTE,
    action: '/flashcards/flashcards'
  },
  {
    key: 'notes',
    label: 'APP.CONTENT_TYPE.NOTE',
    icon: JournalOutline,
    actionType: MenuActionType.ROUTE,
    action: '/notes/notes'
  },
  {
    key: 'chat',
    label: 'APP.BASE.CHAT',
    icon: ChatbubbleEllipses,
    actionType: MenuActionType.WEBVIEW,
    action: '/webview/chat'
  }
]

export const DEMO_NEW_OPTIONS: NewOption[] = [
  {
    key: 'new_note',
    label: 'ACTION.NEW.NEW_NOTE',
    icon: JournalOutline,
    actionType: MenuActionType.ROUTE,
    action: '/notes/new_note'
  },
  {
    key: 'new_flashcard',
    label: 'ACTION.NEW.NEW_FLASHCARD',
    icon: ClipboardOutline,
    actionType: MenuActionType.ROUTE,
    action: '/flashcards/new_flashcard'
  },
]

export const WORK_TYPE_MENU_ITEMS: MenuItem[] = [ 
  {
    key: 'notes',
    label: 'APP.CONTENT_TYPE.NOTE',
    icon: JournalOutline,
    actionType: MenuActionType.ROUTE,
    action: '/notes/notes',
    isVisible: true
  },
  {
    key: 'flashcards',
    label: 'APP.CONTENT_TYPE.FLASHCARD',
    icon: ClipboardOutline,
    actionType: MenuActionType.ROUTE,
    action: '/flashcards/flashcards',
    isVisible: true
  },
  {
    key: 'assets',
    label: 'APP.BASE.ASSETS',
    icon: ImagesOutline,
    actionType: MenuActionType.ROUTE,
    action: '/assets/assets',
    isVisible: true
  },
  {
    key: 'chat',
    label: 'APP.BASE.CHAT',
    icon: ChatbubbleEllipses,
    actionType: MenuActionType.WEBVIEW,
    action: '/webview/chat',  
    isVisible: true
  }
]

export const WORK_TYPE_NEW_OPTIONS: NewOption[] = [
  {
    key: 'new_note',
    label: 'ACTION.NEW.NEW_NOTE',
    icon: JournalOutline,
    actionType: MenuActionType.ROUTE,
    action: '/notes/new_note',
    isVisible: true
  },
  {
    key: 'new_flashcard',
    label: 'ACTION.NEW.NEW_FLASHCARD',
    icon: ClipboardOutline,
    actionType: MenuActionType.ROUTE,
    action: '/flashcards/new_flashcard',
    isVisible: true
  },
]
