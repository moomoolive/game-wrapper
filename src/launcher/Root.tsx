import { useState, useEffect, ReactNode } from 'react'
import {
  Button, 
  Menu,
  MenuItem,
  Tooltip,
  Collapse,
} from "@mui/material"
import SettingsIcon from "@mui/icons-material/Settings"
import LoadingIconGlobal from "@/components/LoadingIcon"
import {isIframe} from "@/lib/utils/isIframe"
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome"
import {
  faTimes, faCheck, faBox, faCodeBranch,
  faLink, faTerminal, faFolderMinus
} from "@fortawesome/free-solid-svg-icons"
import {faChrome} from "@fortawesome/free-brands-svg-icons"
import {BYTES_PER_GB} from "@/lib/utils/consts/storage"
import {Shabah} from "@/lib/shabah/wrapper"
import {roundDecimal} from "@/lib/math/rounding"
import {featureCheck} from "@/lib/utils/appFeatureCheck"
import {useGlobalConfirm} from "@/hooks/globalConfirm"
import {sleep} from "@/lib/utils/sleep"
import type {TopLevelAppProps} from "@/lib/types/globalState"

if (isIframe()) {
  new Error("launcher cannot run inside of an iframe")
}

const LoadingIcon = () => <span className="text-lg animate-spin">
  <LoadingIconGlobal/>
</span>

const UnsupportedFeatures = ({features}: {
  features: {name: string, supported: boolean, hardwareRelated?: boolean}[]
}) => {
  const [showFeatureDetails, setShowFeatureDetails] = useState(false)

  const hardwareRequirementNotMet = features.some((feature) => {
    return feature.hardwareRelated && !feature.supported
  })

  const softwareRequirementsNotMet = features.some((feature) => {
    return !feature.hardwareRelated && !feature.supported
  })

  let requirementText = ""

  if (hardwareRequirementNotMet && softwareRequirementsNotMet) {
    requirementText = "device & browser"
  } else if (hardwareRequirementNotMet) {
    requirementText = "device"
  } else if (softwareRequirementsNotMet) {
    requirementText = "browser"
  }

  return <>
    <div className="text-sm text-yellow-500 mb-3 mt-6">
      {`Your ${requirementText} ${softwareRequirementsNotMet && hardwareRequirementNotMet ? "don't" : "doesn't"} support all required features.`}<br/>
      {softwareRequirementsNotMet ? <>
        {"Try using the latest version of Chrome"}
        <span className="ml-2">
          <FontAwesomeIcon 
            icon={faChrome}
          />
        </span>
      </> : ""}
    </div>

    <div>
      <Button 
        size="small"
        color="info"
        onClick={() => setShowFeatureDetails(current => !current)}
      >
        {showFeatureDetails ? "Hide" : "Details"}
      </Button>
    </div>

    <Collapse in={showFeatureDetails}>
      <div className="max-w-sm mx-auto text-left">
          {features.filter(({supported}) => !supported).map((feature, i) => {
            const hardwareRelated = feature.hardwareRelated || false
            return <div
              key={`feature-check-${i}`}
              className="text-sm mb-1"
            >
              <span className="mr-2">
                {`${hardwareRelated ? "????" : "????"} `}
                {feature.name
                  .split("-")
                  .map((str) => str[0].toUpperCase() + str.slice(1))
                  .join(" ")}
              </span>
              {feature.supported ? <span 
                className="text-green-500"
              >
                <FontAwesomeIcon 
                  icon={faCheck}
                />  
              </span> : <span
                className="text-red-500"
              >
                <FontAwesomeIcon 
                  icon={faTimes}
                />  
              </span>}
              <span className="ml-2 text-xs text-neutral-500">
                {hardwareRelated ? "(hardware)" : "(browser)"}
              </span>
            </div>
          })}
      </div>
    </Collapse>
  </>
}

const appPackageId = "std-pkg"

const toGigabytes = (number: number) => {
  const decimal = number / BYTES_PER_GB
  const rounded = roundDecimal(decimal, 1)
  return Math.max(rounded, 0.1)
}

const toPercent = (fraction: number, decimals: number) => {
  return roundDecimal(fraction * 100, decimals)
}

const progressIndicator = (downloaded: number, total: number) => {
  return <div>
    <div>Updating App...</div>
      <div className="mt-1.5 flex items-center justify-center text-xs text-neutral-400">
        <div className="mr-2 text-blue-500 animate-bounce">
          <FontAwesomeIcon
            icon={faBox}
          />
        </div>
        <div>
          {toGigabytes(downloaded)} GB / {toGigabytes(total)} GB 
        </div>
        <div className="ml-2 text-blue-500">
          <span></span>{`(${toPercent(downloaded / total, 1)}%)`}
        </div>
      </div>
  </div>
}

type PwaInstallPrompt = {
  prompt: () => void
  userChoice: () => Promise<"accepted" | "dismissed">
}

type PwaInstallEvent = Event & PwaInstallPrompt

const APP_TITLE = "Game Launcher"
let pwaInstallPrompt = null as null | PwaInstallEvent

export const LauncherRoot = ({
  id,
  globalState
}: {
  id: string
  globalState: TopLevelAppProps
}) => {
  const confirm = useGlobalConfirm()
  const {
    showLauncher, setTerminalVisibility, downloadClient
  } = globalState
  const launchApp = () => showLauncher(false)

  const [showProgress, setShowProgress] = useState(false)
  const [progressMsg, setProgressMsg] = useState<ReactNode>("")
  const [settingsMenuElement, setSettingsMenuElement] = useState<null | HTMLElement>(null)
  const [supportedFeatures] = useState(featureCheck())
  const [downloadError, setDownloadError] = useState("")
  const [previousUpdateFailed, setPreviousUpdateFailed] = useState(false)
  const [buttonElement, setButtonElement] = useState(<>
    {"start"}
  </>)
  const [
    afterUpdateCheckAction, 
    setAfterUpdateCheckAction
  ] = useState<null | Function>(null)
  const [checkedForUpdates, setCheckedForUpdates] = useState(false)
  const [appUpdateInProgress, setAppUpdateInProgress] = useState(false)
  const [nextUpdateVersion, setNextUpdateVersion] = useState("none")
  const [
    currentAppVersion, 
    setCurrentAppVersion
  ] = useState(Shabah.NO_PREVIOUS_INSTALLATION)
  const allFeaturesSupported = supportedFeatures.every((feature) => feature.supported)

  const closeSettings = () => setSettingsMenuElement(null)

  const addProgressListener = () => {
    downloadClient.addProgressListener(appPackageId, async (progress) => {
      const {finished, installing, total, downloaded, failed} = progress
      if (failed) {
        setShowProgress(false)
        setAppUpdateInProgress(false)
        setPreviousUpdateFailed(true)
        setDownloadError("Update Failed...")
        setButtonElement(<>{"Retry"}</>)
        document.title = APP_TITLE
        const meta = await downloadClient.getCargoMeta(appPackageId)
        setCurrentAppVersion(meta?.version || Shabah.NO_PREVIOUS_INSTALLATION)
      } else if (finished) {
        setProgressMsg("Installing...")
        document.title = "Installing..."
        await sleep(2_000)
        document.title = APP_TITLE
        launchApp()
      } else if (installing) {
        setProgressMsg("Installing...")
        document.title = "Installing..."
      } else {
        const percent = toPercent(downloaded / total, 1)
        console.log("p", percent)
        document.title = `(${percent}%) Updating...`
        setProgressMsg(progressIndicator(downloaded, total))
      }
    })
  }

  const gatherAssets = async () => {
    if (isIframe()) {
      return
    }
    if (checkedForUpdates && afterUpdateCheckAction) {
      return afterUpdateCheckAction()
    }
    setDownloadError("")
    setShowProgress(true)
    setButtonElement(
      <span className='animate-spin'>
        <LoadingIcon/>
      </span>
    )
    setProgressMsg("Checking for Updates...")
    const root = location.origin + "/"
    const [res] = await Promise.all([
      downloadClient.checkForCargoUpdates({
        requestUrl: root,
        storageUrl: root,
        name: "std",
        id: appPackageId
      }),
      // should take at least 500ms
      sleep(500),
    ] as const)
    
    const previousVersionExists = res.updateCheckResponse.previousVersionExists
    
    setCheckedForUpdates(true)
    if (previousVersionExists && !res.enoughSpaceForPackage) {
      const updateVersion = res.versions.new
      setDownloadError(`Not enough disk space for update v${updateVersion} (${res.diskInfo.bytesNeededToDownloadFriendly} required)`)
      setButtonElement(<>{"Start Anyway"}</>)
      setAfterUpdateCheckAction(() => launchApp)
      setShowProgress(false)
      return
    } else if (previousVersionExists && res.errorOccurred) {
      setDownloadError(`Error occured when checking for updates`)
      setButtonElement(<>{"Start Anyway"}</>)
      setAfterUpdateCheckAction(() => launchApp)
      setShowProgress(false)
      return
    } else if (
      (!previousVersionExists && res.errorOccurred)
      || (!previousVersionExists && !res.enoughSpaceForPackage)
    ) {
      if (!res.enoughSpaceForPackage) {
        setDownloadError(`Not enough disk space install (${res.diskInfo.bytesNeededToDownloadFriendly} required)`)
      } else {
        setDownloadError("Couldn't contact update server")
      }
      setAfterUpdateCheckAction(null)
      setButtonElement(<>{"Retry"}</>)
      setShowProgress(false)
      return
    }

    if (!res.updateAvailable && previousUpdateFailed) {
      setProgressMsg("Updating...")
      document.title = "Updating..."
      setAppUpdateInProgress(true)
      addProgressListener()
      await downloadClient.retryFailedDownload(appPackageId)
      return
    }

    if (!res.updateAvailable) {
      launchApp()
      return
    }
    await downloadClient.cacheRootDocumentFallback()
    setProgressMsg(`Update Found! Queuing...`)
    const updateQueueRes = await downloadClient.executeUpdates(
      res,
      `core v${res.versions.new}`,
    )
    
    if (updateQueueRes.data !== Shabah.STATUS.updateQueued) {
      await sleep(2_000)
      setShowProgress(false)
      setDownloadError("Couldn't Queue Update")
      setButtonElement(<>{"Retry"}</>)
      return
    }
    await sleep(1_000)
    setProgressMsg("Updating...")
    document.title = "Updating..."
    setAppUpdateInProgress(true)
    setCurrentAppVersion(res.versions.old)
    setNextUpdateVersion(res.versions.new)
    addProgressListener()
  }

  useEffect(() => {
    (async () => {
      const currentAppPkg = await downloadClient.getCargoMeta(appPackageId)
      if (!currentAppPkg || currentAppPkg.state === "archived") {
        return
      }
      const {state} = currentAppPkg
      if (state === "cached") {
        setCurrentAppVersion(currentAppPkg.version)
        return 
      }
      if (state === "update-aborted" || state === "update-failed") {
        setPreviousUpdateFailed(true)
        setCurrentAppVersion(currentAppPkg.version)
        if (state === "update-aborted") {
          setDownloadError("Update Aborted...")
          setButtonElement(<>{"Resume"}</>)
        } else {
          setDownloadError("Update Failed...")
          setButtonElement(<>{"Retry"}</>)
        }
        return
      }
      const updateInfo = await downloadClient.getDownloadState(appPackageId)
      if (!updateInfo) {
        return
      }
      const {previousVersion, version} = updateInfo
      setCurrentAppVersion(previousVersion)
      setButtonElement(
        <span className='animate-spin'>
          <LoadingIcon/>
        </span>
      )
      setAppUpdateInProgress(true)
      setShowProgress(true)
      setProgressMsg(`Updating...`)
      document.title = "Updating..."
      setNextUpdateVersion(version)
      addProgressListener()
    })()
    return downloadClient.removeProgressListener(appPackageId)
  }, [])

  return (
    <div 
      id={id}
      className="relative text-center animate-fade-in z-0 w-screen h-screen flex justify-center items-center"
    >
        <div className="relative z-0">
            <div id="launcher-menu" className="fixed top-2 left-0">
              <Tooltip title="Settings">
                  <Button
                  variant="text"
                  size="small"
                  onClick={(e) => {
                      if (settingsMenuElement) {
                      closeSettings()
                      } else {
                      setSettingsMenuElement(e.currentTarget)
                      }
                  }}
                  >
                  <SettingsIcon/>
                  </Button>
              </Tooltip>

              <Menu
                  anchorEl={settingsMenuElement}
                  open={!!settingsMenuElement}
                  onClose={closeSettings}
                  className="text-xs"
              >
                  <MenuItem 
                    onClick={() => {
                        setTerminalVisibility(true)
                        closeSettings()
                    }}
                  >
                    <div className="text-sm hover:text-green-500">
                      <span className="mr-2 text-xs">
                          <FontAwesomeIcon
                            icon={faTerminal}
                          />
                      </span>
                      Terminal
                    </div>
                  </MenuItem>

                  <MenuItem 
                    onClick={() => {
                        console.log("bookmark", pwaInstallPrompt)
                    }}
                  >
                    <div className="text-sm hover:text-green-500">
                      <span className="mr-2 text-xs">
                          <FontAwesomeIcon
                            icon={faLink}
                          />
                      </span>
                      Create Desktop Link
                    </div>
                  </MenuItem>

                  <MenuItem 
                    onClick={async () => {
                        if (!(await confirm({title: "Are you sure you want to uninstall all files?"}))) {
                          return
                        }
                        setShowProgress(true)
                        setButtonElement(
                          <span className='animate-spin'>
                            <LoadingIcon/>
                          </span>
                        )
                        const message = "Uninstalling..."
                        document.title = message
                        setProgressMsg(message)
                        closeSettings()
                        await Promise.all([
                          sleep(3_000),
                          downloadClient.uninstallAllAssets()
                        ])
                        location.reload()
                    }}
                  >
                    <div className="text-sm hover:text-yellow-500 w-full">
                      <span className="mr-2 text-xs">
                          <FontAwesomeIcon
                            icon={faFolderMinus}
                          />
                      </span>
                      Uninstall
                    </div>
                  </MenuItem>
              </Menu>
            </div>

            <div className="flex w-screen items-center flex-wrap justify-center">
              <div>
                  <Button
                      variant="contained"
                      onClick={gatherAssets}
                      disabled={
                        !allFeaturesSupported 
                        || showProgress
                        || appUpdateInProgress
                      }
                  >
                      {buttonElement}
                  </Button>
              </div>
            </div>

            {!allFeaturesSupported ? <>
              <UnsupportedFeatures 
                features={supportedFeatures.slice(0, -1)}
              />
            </> : <></>}
            
            <Collapse in={showProgress}>
                <div className="mt-4 w-4/5 mx-auto text-sm">
                  {progressMsg}
                </div>
            </Collapse>

            <Collapse in={downloadError.length > 0}>
                <div className="text-yellow-500 mt-4 text-sm">
                  {downloadError}
                </div>
            </Collapse>

           <Tooltip
            placement="top"
            title={
              currentAppVersion === Shabah.NO_PREVIOUS_INSTALLATION 
                ? "Not installed yet"
                : `Release Notes`
            }
           >
              <div className="fixed z-10 text-xs bottom-0 left-0 text-neutral-500 rounded">
                <button
                  className="hover:bg-neutral-900 p-2"
                >
                  <span className={`mr-1.5 ${previousUpdateFailed ? "text-yellow-400" : "text-blue-400"}`}>
                      <FontAwesomeIcon 
                        icon={faCodeBranch}
                      />
                  </span>
                  {currentAppVersion === Shabah.NO_PREVIOUS_INSTALLATION ? "not installed" : "v" + currentAppVersion}
                  {appUpdateInProgress && !previousUpdateFailed ? <>
                    <span className="ml-1 text-blue-500">
                      {"=>"}
                    </span>
                    <span className="ml-1 text-green-700 animate-pulse">
                      {nextUpdateVersion}
                    </span> 
                  </> : <></>}
                </button>
              </div>
            </Tooltip>
            
            
        </div>
    </div>
  )
}
