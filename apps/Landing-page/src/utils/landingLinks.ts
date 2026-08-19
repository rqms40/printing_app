const defaultMobileWebPort = '8088';
const defaultGithubRepo = 'rqms40/printing_app';
const defaultApkAssetName = 'GRIDGO-latest.apk';
export const currentReleaseVersion = 'v1.12.4';
export const currentReleaseApkAssetName = 'GRIDGO-v1.12.4.apk';
const defaultCommunityUrl = 'https://m.me/GRIDGOPrintPH';

type LocationLike = Pick<
  Location,
  'protocol' | 'hostname' | 'port' | 'pathname' | 'search' | 'hash' | 'href'
>;

export function getMobileWebUrl(
  location: LocationLike,
  port = defaultMobileWebPort,
) {
  const url = new URL(location.href);
  url.port = port;
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function getLatestApkDownloadUrl(
  repo = defaultGithubRepo,
  assetName = defaultApkAssetName,
) {
  return `https://github.com/${repo}/releases/latest/download/${assetName}`;
}

export function getVersionedApkDownloadUrl(
  version = currentReleaseVersion,
  repo = defaultGithubRepo,
  assetName = currentReleaseApkAssetName,
) {
  return `https://github.com/${repo}/releases/download/${version}/${assetName}`;
}

export function getReleasePageUrl(
  version = currentReleaseVersion,
  repo = defaultGithubRepo,
) {
  return `https://github.com/${repo}/releases/tag/${version}`;
}

export function isMobileUserAgent(userAgent: string) {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent,
  );
}

export function shouldRedirectToMobileWeb(
  location: LocationLike,
  userAgent: string,
  port = defaultMobileWebPort,
) {
  const params = new URLSearchParams(location.search);
  return (
    isMobileUserAgent(userAgent) &&
    location.port !== port &&
    params.get('desktop') !== '1'
  );
}

export function landingLinks(location: LocationLike) {
  const mobileWebPort =
    import.meta.env.VITE_MOBILE_WEB_PORT || defaultMobileWebPort;
  const githubRepo = import.meta.env.VITE_GITHUB_REPO || defaultGithubRepo;
  const apkAssetName =
    import.meta.env.VITE_APK_ASSET_NAME || defaultApkAssetName;
  const communityUrl =
    import.meta.env.VITE_GRID_COMMUNITY_URL?.trim() || defaultCommunityUrl;

  return {
    mobileWebUrl: getMobileWebUrl(location, mobileWebPort),
    apkDownloadUrl: getLatestApkDownloadUrl(githubRepo, apkAssetName),
    communityUrl,
    mobileWebPort,
  };
}
