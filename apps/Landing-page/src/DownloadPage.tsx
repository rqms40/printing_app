import { ArrowLeft, BadgeCheck, Download, ShieldCheck, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  currentReleaseApkAssetName,
  currentReleaseVersion,
  getLatestApkDownloadUrl,
  getVersionedApkDownloadUrl,
} from './utils/landingLinks';

const latestApkAssetName = 'GRIDGO-latest.apk';
const versionedApkAssetName = 'GRIDGO-v1.12.6.apk';

export default function DownloadPage() {
  const latestApkUrl = getLatestApkDownloadUrl(latestApkAssetName);
  const versionedApkUrl = getVersionedApkDownloadUrl(versionedApkAssetName);

  return (
    <main className="min-h-screen bg-[#050505] text-white px-5 py-8 md:px-10 md:py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-[var(--color-primary)]"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to GRIDGO
        </Link>

        <section className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-7 shadow-2xl md:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-extrabold tracking-wide text-black">BETA</span>
            <span className="inline-flex items-center gap-2 text-sm text-white/70"><BadgeCheck size={16} aria-hidden="true" /> Verified beta release</span>
          </div>

          <div className="mt-7 grid gap-10 md:grid-cols-[1.35fr_0.65fr] md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">GRIDGO Android Beta</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Download GRIDGO</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/75 md:text-lg">
                Install the current Android beta to access GRIDGO from your phone. The app connects securely to the GRIDGO legacy domain and is ready for your beta feedback.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-black/30 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-white/55">Current release</p>
              <p className="mt-2 text-3xl font-black text-[var(--color-primary)]">{currentReleaseVersion}</p>
              <p className="mt-2 text-sm text-white/65">Android only · Beta channel</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <a
              href={latestApkUrl}
              className="group flex items-center justify-between rounded-2xl bg-[var(--color-primary)] px-5 py-5 text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#050505]"
            >
              <span><span className="block text-xs font-bold uppercase tracking-widest">Recommended</span><span className="mt-1 block text-xl font-black">Download latest APK</span><span className="mt-1 block text-sm font-medium">Get the newest GRIDGO beta build</span></span>
              <Download size={28} aria-hidden="true" />
            </a>
            <a
              href={versionedApkUrl}
              className="group flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-5 transition hover:border-[var(--color-primary)]/70 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <span><span className="block text-xs font-bold uppercase tracking-widest text-white/55">Current Beta</span><span className="mt-1 block text-xl font-black">Download {currentReleaseVersion}</span><span className="mt-1 block text-sm text-white/65">Pinned build: {currentReleaseApkAssetName}</span></span>
              <Download size={28} className="text-[var(--color-primary)]" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-5 text-sm leading-6 text-white/70 md:grid-cols-[auto_1fr] md:items-center">
            <Smartphone className="text-[var(--color-primary)]" aria-hidden="true" />
            <p><span className="font-bold text-white">First install?</span> Android may ask you to allow installs from your browser. Download from this official GRIDGO page, then open the APK to install.</p>
          </div>

          <div className="mt-5 flex items-start gap-3 text-sm text-white/55">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
            <p>Use the latest button for the current beta, or choose the versioned build when you need a specific release.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
