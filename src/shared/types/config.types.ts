interface miniProgram {
    id: string
    name: string
    url: string
    icon?: string
    area: string
    isHidden: boolean
}
export interface AppConfig {
    general: {       
        theme: string
        locale: string
        autoSave: boolean
        autoSaveInterval: number
        updateChannel: string
        autoStart: boolean
        messageNotify: boolean        
    }
    miniPrograms: miniProgram[]
    version: string
    workspace: string
    updatedAt: string
}
