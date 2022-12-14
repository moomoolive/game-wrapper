import {webBackgroundFetchDownloadManager} from "./downloadManager/backgroundFetch"
import {webCacheFileCache} from "./fileCache/webCache"
import {webFetch} from "./networkRequest/webFetch"

export const webAdaptors = (cacheName: string) => {
    return {
        fileCache: webCacheFileCache(cacheName),
        networkRequest: webFetch(),
        downloadManager: webBackgroundFetchDownloadManager()
    }
}