export const isIframe = () => {
    try {
        return window.self !== window.top
    } catch {
        return true
    }
}