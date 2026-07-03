import { logger } from '../../lib/logger';
import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { GetSystemInfo, CheckForUpdates } from '@/wailsjs/go/main/App';
import { X as CloseIcon, ExternalLink } from 'lucide-react';
import { useFlowStore } from '../../store';
import { cn } from '../../lib/utils';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemInfo {
  os: string;
  arch: string;
  goVersion: string;
  version: string;
}

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  isPrerelease: boolean;
}

const UpdateStatus: React.FC<{
  isChecking: boolean;
  updateInfo: UpdateInfo | null;
  appVersion: string;
  colorMode: string;
}> = ({ isChecking, updateInfo, appVersion, colorMode }) => {
  const containerClass = cn(
    "mb-8 p-3 rounded border text-[12px]",
    colorMode === 'dark' ? "bg-[#1e1f22] border-[#393b40]" : "bg-gray-50 border-gray-200"
  );
  const textClass = colorMode === 'dark' ? "text-gray-400" : "text-gray-500";

  if (isChecking) {
    return (
      <div className={containerClass}>
        <p className={textClass}>Checking for updates...</p>
      </div>
    );
  }

  if (!updateInfo) {
    return (
      <div className={containerClass}>
        <p className="text-red-400">Failed to check for updates</p>
      </div>
    );
  }

  if (updateInfo.updateAvailable && updateInfo.latestVersion) {
    return (
      <div className={containerClass}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-blue-500 font-medium">New version available: v{updateInfo.latestVersion}</p>
            {updateInfo.isPrerelease && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                Pre-release
              </span>
            )}
          </div>
          <a
            href={updateInfo.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:underline"
          >
            View on GitHub <ExternalLink size={12} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <p className={textClass}>You are up to date (v{appVersion})</p>
    </div>
  );
};

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const colorMode = useFlowStore((state: any) => state.colorMode);
  const [appVersion, setAppVersion] = useState('0.1.0');
  const [appName] = useState('Kube Simulator');
  const [appCopyright] = useState('Copyright 2026');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsCheckingUpdate(true);
      try {
        const info = await GetSystemInfo();
        const sys: SystemInfo = {
          os: (info as any).os ?? '',
          arch: (info as any).arch ?? '',
          goVersion: (info as any).goVersion ?? '',
          version: (info as any).version ?? '',
        };
        setSystemInfo(sys);
        if (sys.version) {
          setAppVersion(sys.version);
        }

        const update = await CheckForUpdates(sys.version || appVersion);
        setUpdateInfo(update);
      } catch (error) {
        logger.error("Failed to fetch info:", error);
      } finally {
        setIsCheckingUpdate(false);
      }
    }

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, appVersion]);

  const handleCopy = async () => {
    const textToCopy = `${appName} ${appVersion}
Build #KS-${appVersion}, built on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Runtime version: ${systemInfo?.goVersion} ${systemInfo?.arch}
VM: Go by Google
Operating system: ${systemInfo?.os}
Architecture: ${systemInfo?.arch}

${appCopyright}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Failed to copy", err);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-transparent" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={cn(
                "w-full max-w-[640px] transform overflow-hidden rounded-md text-left align-middle shadow-2xl transition-all border relative",
                colorMode === 'dark' ? "bg-[#2b2d30] border-[#1e1f22]" : "bg-white border-gray-200"
              )}>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close About"
                  className={cn(
                    "absolute top-4 right-4 transition-colors focus:outline-none",
                    colorMode === 'dark' ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <CloseIcon size={20} />
                </button>
                <div className="flex p-8">
                  {/* Left Column: Big Logo */}
                  <div className="flex-shrink-0 mr-8">
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center text-white text-7xl font-bold">
                      K
                    </div>
                  </div>

                  {/* Right Column: Details */}
                  <div className={cn(
                    "flex-1 text-[13px] leading-relaxed font-sans",
                    colorMode === 'dark' ? "text-[#dfdedd]" : "text-[#000000]"
                  )}>
                    <div className="mb-4 flex items-baseline">
                      <span className={cn(
                        "text-2xl font-semibold tracking-tight mr-2",
                        colorMode === 'dark' ? "text-[#dfdedd]" : "text-gray-900"
                      )}>
                        {appName}
                      </span>
                      <span className={cn(
                        "text-lg",
                        colorMode === 'dark' ? "text-[#a9a9a9]" : "text-gray-600"
                      )}>
                        {appVersion || ""}
                      </span>
                    </div>

                    <div className="space-y-1 mb-6">
                      <p>
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>Build #KS-</span>{appVersion || "Unknown"}
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>, built on </span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p>
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>Runtime version: </span>{systemInfo?.goVersion} {systemInfo?.arch}
                      </p>
                      <p>
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>VM: </span>Go by Google
                      </p>
                      <p>
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>Operating system: </span>{systemInfo?.os}
                      </p>
                      <p>
                        <span className={cn(colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>Architecture: </span>{systemInfo?.arch}
                      </p>
                    </div>

                    <p className={cn("mb-6", colorMode === 'dark' ? "text-[#808080]" : "text-gray-500")}>
                      {appCopyright}
                    </p>

                    {/* Update Info */}
                    <UpdateStatus
                      isChecking={isCheckingUpdate}
                      updateInfo={updateInfo}
                      appVersion={appVersion}
                      colorMode={colorMode}
                    />

                    {/* Actions */}
                    <div className="flex items-center mt-4">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={cn(
                          "px-4 py-1.5 rounded-sm border text-[13px] font-sans transition-colors outline-none focus:ring-2 focus:ring-[#3574f0]",
                          colorMode === 'dark'
                            ? "bg-[#4b4d51] hover:bg-[#5a5d61] text-[#dfdedd] border-[#5a5d61]"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300"
                        )}
                      >
                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AboutDialog;

