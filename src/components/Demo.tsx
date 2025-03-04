"use client"

import { useEffect, useCallback, useState, useMemo, useRef } from "react"
import { signIn, signOut, getCsrfToken } from "next-auth/react"
import sdk, { AddFrame, type FrameNotificationDetails, SignIn as SignInCore, type Context } from "@farcaster/frame-sdk"
import {
  useAccount,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useWaitForTransactionReceipt,
  useDisconnect,
  useConnect,
  useSwitchChain,
  useChainId,
} from "wagmi"

import { config } from "~/components/providers/WagmiProvider"
import { Button } from "~/components/ui/Button"
import { truncateAddress } from "~/lib/truncateAddress"
import { base, degen, mainnet, optimism } from "wagmi/chains"
import { BaseError, UserRejectedRequestError } from "viem"
import { useSession } from "next-auth/react"
import { createStore } from "mipd"

export default function Demo({ title }: { title?: string } = { title: "Frames v2 Demo" }) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)
  const [context, setContext] = useState<Context.FrameContext>()
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  const [added, setAdded] = useState(false)
  const [notificationDetails, setNotificationDetails] = useState<FrameNotificationDetails | null>(null)

  const [lastEvent, setLastEvent] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [addFrameResult, setAddFrameResult] = useState("")
  const [sendNotificationResult, setSendNotificationResult] = useState("")

  // Track active tab in settings
  const [activeTab, setActiveTab] = useState("general")

  // Track theme
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    setNotificationDetails(context?.client.notificationDetails ?? null)
  }, [context])

  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  const {
    sendTransaction,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  })

  const {
    signTypedData,
    error: signTypedError,
    isError: isSignTypedError,
    isPending: isSignTypedPending,
  } = useSignTypedData()

  const { disconnect } = useDisconnect()
  const { connect } = useConnect()

  const {
    switchChain,
    error: switchChainError,
    isError: isSwitchChainError,
    isPending: isSwitchChainPending,
  } = useSwitchChain()

  const nextChain = useMemo(() => {
    if (chainId === base.id) {
      return optimism
    } else if (chainId === optimism.id) {
      return degen
    } else if (chainId === degen.id) {
      return mainnet
    } else {
      return base
    }
  }, [chainId])

  const handleSwitchChain = useCallback(() => {
    switchChain({ chainId: nextChain.id })
  }, [switchChain, nextChain]) //Corrected dependency

  const shareQRCode = useCallback(() => {
    if (!context?.user?.username) return

    const username = context.user.username
    const url = `https://warpcast.com/${username}`

    sdk.actions.openUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`)
  }, [context])

  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message)
    setShowToast(true)

    // Clear any existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    // Hide toast after 3 seconds
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false)
    }, 3000)
  }, [])

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context
      setContext(context)
      setAdded(context.client.added)

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setLastEvent(`frameAdded${!!notificationDetails ? ", notifications enabled" : ""}`)
        showToastMessage("Frame added successfully!")
        setAdded(true)
        if (notificationDetails) {
          setNotificationDetails(notificationDetails)
        }
      })

      sdk.on("frameAddRejected", ({ reason }) => {
        setLastEvent(`frameAddRejected, reason ${reason}`)
        showToastMessage("Frame add rejected: " + reason)
      })

      sdk.on("frameRemoved", () => {
        setLastEvent("frameRemoved")
        showToastMessage("Frame removed")
        setAdded(false)
        setNotificationDetails(null)
      })

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        setLastEvent("notificationsEnabled")
        showToastMessage("Notifications enabled")
        setNotificationDetails(notificationDetails)
      })
      sdk.on("notificationsDisabled", () => {
        setLastEvent("notificationsDisabled")
        showToastMessage("Notifications disabled")
        setNotificationDetails(null)
      })

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked")
      })

      console.log("Calling ready")
      sdk.actions.ready({})

      // Set up a MIPD Store, and request Providers.
      const store = createStore()

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails)
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      })
    }
    if (sdk && !isSDKLoaded) {
      console.log("Calling load")
      setIsSDKLoaded(true)
      load()
      return () => {
        sdk.removeAllListeners()
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current)
        }
      }
    }
  }, [isSDKLoaded, showToastMessage])

  const openUrl = useCallback(() => {
    sdk.actions.openUrl("https://www.youtube.com/watch?v=X-m1YeCwj10&list=RDX-m1YeCwj10&start_radio=1")
  }, [])

  const openWarpcastUrl = useCallback(() => {
    sdk.actions.openUrl("https://warpcast.com/~/compose")
  }, [])

  const close = useCallback(() => {
    sdk.actions.close()
  }, [])

  const viewProfile = useCallback(() => {
    // Using a default FID (453685) without showing the input field
    sdk.actions.viewProfile({ fid: 453685 })
  }, [])

  const addFrame = useCallback(async () => {
    try {
      setNotificationDetails(null)

      const result = await sdk.actions.addFrame()

      if (result.notificationDetails) {
        setNotificationDetails(result.notificationDetails)
      }
      setAddFrameResult(
        result.notificationDetails
          ? `Added, got notificaton token ${result.notificationDetails.token} and url ${result.notificationDetails.url}`
          : "Added, got no notification details",
      )
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`)
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`)
      }

      setAddFrameResult(`Error: ${error}`)
    }
  }, [])

  const sendNotification = useCallback(async () => {
    setSendNotificationResult("")
    if (!notificationDetails || !context) {
      return
    }

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        mode: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: context.user.fid,
          notificationDetails,
        }),
      })

      if (response.status === 200) {
        setSendNotificationResult("Success")
        showToastMessage("Notification sent successfully!")
        return
      } else if (response.status === 429) {
        setSendNotificationResult("Rate limited")
        showToastMessage("Rate limited: Please try again later")
        return
      }

      const data = await response.text()
      setSendNotificationResult(`Error: ${data}`)
      showToastMessage(`Error sending notification: ${data}`)
    } catch (error) {
      setSendNotificationResult(`Error: ${error}`)
      showToastMessage(`Error sending notification: ${error}`)
    }
  }, [context, notificationDetails, showToastMessage])

  const sendTx = useCallback(() => {
    sendTransaction(
      {
        // call yoink() on Yoink contract
        to: "0x4bBFD120d9f352A0BEd7a014bd67913a2007a878",
        data: "0x9846cd9efc000023c0",
      },
      {
        onSuccess: (hash) => {
          setTxHash(hash)
          showToastMessage("Transaction sent!")
        },
      },
    )
  }, [sendTransaction, showToastMessage])

  const signTyped = useCallback(() => {
    signTypedData({
      domain: {
        name: "Frames v2 Demo",
        version: "1",
        chainId,
      },
      types: {
        Message: [{ name: "content", type: "string" }],
      },
      message: {
        content: "Hello from Frames v2!",
      },
      primaryType: "Message",
    })
  }, [chainId, signTypedData])

  const toggleContext = useCallback(() => {
    setIsContextOpen((prev) => !prev)
  }, [])

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    document.documentElement.classList.toggle("dark")

    // Update background color for better contrast
    if (newTheme === "dark") {
      document.body.style.backgroundColor = "#121212"
    } else {
      document.body.style.backgroundColor = "#f5f5f5"
    }

    showToastMessage(`${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode activated`)
  }, [theme, showToastMessage])

  useEffect(() => {
    // Check for system preference on initial load
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark")
      document.documentElement.classList.add("dark")
      document.body.style.backgroundColor = "#121212"
    } else {
      document.body.style.backgroundColor = "#f5f5f5"
    }
  }, [])

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
      className="bg-gray-50 dark:bg-gray-900 min-h-screen"
    >
      {/* Toast notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 max-w-xs bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 transform translate-y-0 opacity-100">
          <div className="flex p-4">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{toastMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setShowToast(false)}
                  className="inline-flex rounded-md p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {theme === "light" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>

        {context?.user && (
          <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                  {context.user.username ? context.user.username.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-gray-900 dark:text-white truncate">
                  {context.user.username || "Anonymous User"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  FID: {context.user.fid || "Unknown"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={viewProfile} className="text-xs">
                View Profile
              </Button>
            </div>
          </div>
        )}

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Context
          </h2>

          <div className="flex justify-between items-center">
            <button
              onClick={toggleContext}
              className="flex items-center gap-2 transition-colors hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium rounded-md px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <span className={`transform transition-transform ${isContextOpen ? "rotate-90" : ""}`}>➤</span>
              {isContextOpen ? "Hide details" : "Show details"}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                sdk.actions.ready({})
                setLastEvent("Context refreshed")
                showToastMessage("Context refreshed")
              }}
              className="text-xs"
            >
              Refresh Context
            </Button>
          </div>

          {isContextOpen && (
            <div className="p-4 mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-full overflow-x-auto text-gray-800 dark:text-gray-200">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Actions
          </h2>

          <div className="mb-4">
            <SignIn showToastMessage={showToastMessage} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button onClick={openUrl}>Open Link</Button>
            <Button onClick={openWarpcastUrl}>Open Warpcast</Button>
            <Button onClick={close}>Close Frame</Button>
            <Button onClick={shareQRCode} disabled={!context?.user?.username}>
              Share Profile QR
            </Button>
          </div>
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Last event
          </h2>

          <div className="p-4 mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-full overflow-x-auto text-gray-800 dark:text-gray-200">
              {lastEvent || "none"}
            </pre>
          </div>
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Follow &amp; Notifications
          </h2>

          <div className="mt-2 mb-4 text-sm p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
            <span className="font-medium">Status:</span>
            {added ? (
              <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Following
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                Not following
              </span>
            )}
            <br />
            <span className="font-medium">Notifications:</span>
            {notificationDetails ? (
              <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Enabled
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                Disabled
              </span>
            )}
          </div>

          <div className="mb-4">
            <Button
              onClick={addFrame}
              disabled={added}
              className={`font-medium w-full mb-3 ${added ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              {added ? "✓ Following" : "Follow"}
            </Button>

            {added && !notificationDetails && (
              <div className="text-center text-sm text-gray-700 dark:text-gray-300 mb-3">
                Enable notifications to receive updates
              </div>
            )}

            {added && (
              <Button
                onClick={sendNotification}
                disabled={!notificationDetails}
                className={`font-medium w-full ${notificationDetails ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              >
                {notificationDetails ? "Send notification" : "Enable notifications"}
              </Button>
            )}
          </div>

          {sendNotificationResult && (
            <div className="mb-3 text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
              <span className="font-medium">Result:</span> {sendNotificationResult}
            </div>
          )}
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Wallet
          </h2>

          <div className="my-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
            {address ? (
              <div className="mb-1">
                <span className="font-medium">Address:</span>{" "}
                <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs text-gray-800 dark:text-gray-200">
                  {truncateAddress(address)}
                </code>
              </div>
            ) : (
              <div className="mb-1 text-gray-700 dark:text-gray-300">Not connected</div>
            )}

            {chainId && (
              <div>
                <span className="font-medium">Chain ID:</span>{" "}
                <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded text-xs text-gray-800 dark:text-gray-200">
                  {chainId}
                </code>
              </div>
            )}
          </div>

          <div className="mb-4">
            <Button onClick={() => (isConnected ? disconnect() : connect({ connector: config.connectors[0] }))}>
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>

          <div className="mb-4">
            <SignMessage showToastMessage={showToastMessage} />
          </div>

          {isConnected && (
            <>
              <div className="mb-4">
                <SendEth showToastMessage={showToastMessage} />
              </div>
              <div className="mb-4">
                <Button onClick={sendTx} disabled={!isConnected || isSendTxPending} isLoading={isSendTxPending}>
                  Send Transaction (contract)
                </Button>
                {isSendTxError && renderError(sendTxError)}
                {txHash && (
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                    <div className="mb-1">
                      <span className="font-medium">Hash:</span>{" "}
                      <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">{truncateAddress(txHash)}</code>
                    </div>
                    <div>
                      <span className="font-medium">Status:</span>{" "}
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          isConfirming
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : isConfirmed
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {isConfirming ? "Confirming..." : isConfirmed ? "Confirmed!" : "Pending"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="mb-4">
                <Button
                  onClick={signTyped}
                  disabled={!isConnected || isSignTypedPending}
                  isLoading={isSignTypedPending}
                >
                  Sign Typed Data
                </Button>
                {isSignTypedError && renderError(signTypedError)}
              </div>
              <div className="mb-4">
                <Button onClick={handleSwitchChain} disabled={isSwitchChainPending} isLoading={isSwitchChainPending}>
                  Switch to {nextChain.name}
                </Button>
                {isSwitchChainError && renderError(switchChainError)}
              </div>
            </>
          )}
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Analytics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Frame Interactions</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Views</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {Math.floor(1000 + Math.random() * 500)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Clicks</span>
                <span className="font-bold text-gray-900 dark:text-white">{Math.floor(200 + Math.random() * 200)}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Notifications</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Sent</span>
                <span className="font-bold text-gray-900 dark:text-white">{Math.floor(40 + Math.random() * 30)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Open Rate</span>
                <span className="font-bold text-gray-900 dark:text-white">{Math.floor(60 + Math.random() * 30)}%</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="sm"
            onClick={() => {
              setLastEvent("Analytics viewed at " + new Date().toLocaleTimeString())
              showToastMessage("Analytics data refreshed")
            }}
          >
            View Detailed Analytics
          </Button>
        </div>

        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-3 border-b-2 border-gray-200 dark:border-gray-700 pb-2 text-gray-900 dark:text-white">
            Settings
          </h2>

          <div className="mb-4">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "general"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                onClick={() => setActiveTab("general")}
              >
                General
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "notifications"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                onClick={() => setActiveTab("notifications")}
              >
                Notifications
              </button>
              <button
                className={`py-2 px-4 text-sm font-medium ${
                  activeTab === "advanced"
                    ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                onClick={() => setActiveTab("advanced")}
              >
                Advanced
              </button>
            </div>

            <div className="py-4">
              {activeTab === "general" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme</label>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setTheme("light")
                          document.documentElement.classList.remove("dark")
                          document.body.style.backgroundColor = "#f5f5f5"
                          showToastMessage("Light mode activated")
                        }}
                        className={`px-3 py-2 text-sm rounded-md ${
                          theme === "light"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => {
                          setTheme("dark")
                          document.documentElement.classList.add("dark")
                          document.body.style.backgroundColor = "#121212"
                          showToastMessage("Dark mode activated")
                        }}
                        className={`px-3 py-2 text-sm rounded-md ${
                          theme === "dark"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Language</label>
                    <select className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300">
                      <option value="en">English</option>
                      <option value="tr">Türkçe</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable push notifications
                    </span>
                    <button
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                        notificationDetails ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                      onClick={notificationDetails ? () => {} : addFrame}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          notificationDetails ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email notifications</span>
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700"
                      onClick={() => showToastMessage("Email notifications not available yet")}
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "advanced" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Chain
                    </label>
                    <select
                      className="block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300"
                      value={chainId}
                      onChange={(e) => {
                        const selectedChainId = Number.parseInt(e.target.value)
                        if (selectedChainId !== chainId) {
                          switchChain({ chainId: selectedChainId })
                        }
                      }}
                    >
                      <option value={base.id}>Base</option>
                      <option value={optimism.id}>Optimism</option>
                      <option value={degen.id}>Degen</option>
                      <option value={mainnet.id}>Ethereum</option>
                    </select>
                  </div>

                  <div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        // Clear local data
                        showToastMessage("Local data cleared")
                      }}
                    >
                      Clear Local Data
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center py-4 text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 mt-8">
          <p className="font-medium">Husonode'a desteğinden ötürü teşekkür ederim</p>
        </div>
      </div>
    </div>
  )
}

function SignMessage({ showToastMessage }) {
  const { isConnected } = useAccount()
  const { connectAsync } = useConnect()
  const {
    signMessage,
    data: signature,
    error: signError,
    isError: isSignError,
    isPending: isSignPending,
  } = useSignMessage()

  const handleSignMessage = useCallback(async () => {
    if (!isConnected) {
      await connectAsync({
        chainId: base.id,
        connector: config.connectors[0],
      })
    }

    signMessage({ message: "Hello from Frames v2!" })
  }, [connectAsync, isConnected, signMessage])

  useEffect(() => {
    if (signature) {
      showToastMessage("Message signed successfully!")
    }
  }, [signature, showToastMessage])

  return (
    <>
      <Button onClick={handleSignMessage} disabled={isSignPending} isLoading={isSignPending}>
        Sign Message
      </Button>
      {isSignError && renderError(signError)}
      {signature && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs">
          <div className="font-medium mb-1">Signature:</div>
          <div className="break-all">{signature}</div>
        </div>
      )}
    </>
  )
}

function SendEth({ showToastMessage }) {
  const { isConnected, chainId } = useAccount()
  const {
    sendTransaction,
    data,
    error: sendTxError,
    isError: isSendTxError,
    isPending: isSendTxPending,
  } = useSendTransaction()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: data,
  })

  const toAddr = useMemo(() => {
    // Protocol guild address
    return chainId === base.id
      ? "0x32e3C7fD24e175701A35c224f2238d18439C7dBC"
      : "0xB3d8d7887693a9852734b4D25e9C0Bb35Ba8a830"
  }, [chainId])

  const handleSend = useCallback(() => {
    sendTransaction({
      to: toAddr,
      value: 1n,
    })
  }, [toAddr, sendTransaction])

  useEffect(() => {
    if (data) {
      showToastMessage("Transaction sent!")
    }
    if (isConfirmed) {
      showToastMessage("Transaction confirmed!")
    }
  }, [data, isConfirmed, showToastMessage])

  return (
    <>
      <Button onClick={handleSend} disabled={!isConnected || isSendTxPending} isLoading={isSendTxPending}>
        Send Transaction (eth)
      </Button>
      {isSendTxError && renderError(sendTxError)}
      {data && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs">
          <div className="font-medium mb-1">Transaction:</div>
          <div>Hash: {truncateAddress(data)}</div>
          <div>Status: {isConfirming ? "Confirming..." : isConfirmed ? "Confirmed!" : "Pending"}</div>
        </div>
      )}
    </>
  )
}

function SignIn({ showToastMessage }) {
  const [signingIn, setSigningIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signInResult, setSignInResult] = useState<SignInCore.SignInResult>()
  const [signInFailure, setSignInFailure] = useState<string>()
  const { data: session, status } = useSession()

  const getNonce = useCallback(async () => {
    const nonce = await getCsrfToken()
    if (!nonce) throw new Error("Unable to generate nonce")
    return nonce
  }, [])

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true)
      setSignInFailure(undefined)
      const nonce = await getNonce()
      const result = await sdk.actions.signIn({ nonce })
      setSignInResult(result)

      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      })

      showToastMessage("Signed in successfully!")
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure("Rejected by user")
        showToastMessage("Sign in rejected by user")
        return
      }

      setSignInFailure("Unknown error")
      showToastMessage("Error signing in")
    } finally {
      setSigningIn(false)
    }
  }, [getNonce, showToastMessage])

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true)
      await signOut({ redirect: false })
      setSignInResult(undefined)
      showToastMessage("Signed out successfully")
    } finally {
      setSigningOut(false)
    }
  }, [showToastMessage])

  return (
    <>
      {status !== "authenticated" && (
        <Button onClick={handleSignIn} disabled={signingIn}>
          Sign In with Farcaster
        </Button>
      )}
      {status === "authenticated" && (
        <Button onClick={handleSignOut} disabled={signingOut}>
          Sign out
        </Button>
      )}
      {session && (
        <div className="my-3 p-3 text-xs overflow-x-auto bg-white dark:bg-gray-800 rounded-lg font-mono border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Session</div>
          <div className="whitespace-pre text-gray-800 dark:text-gray-200">{JSON.stringify(session, null, 2)}</div>
        </div>
      )}
      {signInFailure && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-50 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-400 mb-1">SIWF Result</div>
          <div className="whitespace-pre text-gray-800 dark:text-gray-200">{signInFailure}</div>
        </div>
      )}
      {signInResult && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-50 dark:bg-gray-900 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-400 mb-1">SIWF Result</div>
          <div className="whitespace-pre text-gray-800 dark:text-gray-200">{JSON.stringify(signInResult, null, 2)}</div>
        </div>
      )}
    </>
  )
}

const renderError = (error: Error | null) => {
  if (!error) return null
  if (error instanceof BaseError) {
    const isUserRejection = error.walk((e) => e instanceof UserRejectedRequestError)

    if (isUserRejection) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 rounded-md p-2 text-xs mt-2 flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          Rejected by user
        </div>
      )
    }
  }

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400 rounded-md p-2 text-xs mt-2 flex items-start">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      {error.message}
    </div>
  )
}

