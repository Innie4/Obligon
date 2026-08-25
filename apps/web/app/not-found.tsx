import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="font-display text-7xl font-extrabold text-obligon-green">404</p>
      <h1 className="font-display text-2xl font-extrabold text-obligon-navy">Page not found</h1>
      <p className="max-w-md text-sm text-obligon-text">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-12 items-center rounded-lg bg-obligon-green px-6 font-extrabold text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
