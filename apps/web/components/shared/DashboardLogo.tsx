"use client";

import Image from "next/image";
import { assets } from "@/components/landing/assets";

/**
 * The one logo used by every dashboard sidebar and dashboard header.
 *
 * The source asset is a 384x256 canvas whose visible wordmark only occupies
 * x 80..288, y 92..138 (209x47, a 4.45:1 wordmark) surrounded by large
 * transparent padding. Every dashboard used to compensate with its own
 * `scale-*` and `object-*` anchoring, which is why the logo appeared at a
 * different size and position on each screen.
 *
 * This component ignores the canvas padding: it clips to the visible region so
 * the rendered logo is pixel-identical everywhere, and positions that region at
 * a fixed offset from the container's top-left. Only `width` varies, and the
 * height is always derived from the wordmark's true aspect ratio so it can never
 * distort.
 */

/** Intrinsic canvas and visible-region geometry of obligon-logo.png. */
const CANVAS_W = 384;
const CANVAS_H = 256;
const VISIBLE_X = 80;
const VISIBLE_Y = 92;
const VISIBLE_W = 209;
const VISIBLE_H = 47;

/** Default rendered wordmark width, in px, shared by all dashboards. */
export const DASHBOARD_LOGO_WIDTH = 168;

export function DashboardLogo({
  width = DASHBOARD_LOGO_WIDTH,
  className = "",
  priority = false
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  const scale = width / VISIBLE_W;
  const height = Math.round(VISIBLE_H * scale);

  return (
    <span
      className={`relative block shrink-0 overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <Image
        src={assets.obligonLogo}
        alt="Obligon LTD"
        width={CANVAS_W}
        height={CANVAS_H}
        priority={priority}
        className="absolute left-0 top-0 max-w-none origin-top-left"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(${-VISIBLE_X * scale}px, ${-VISIBLE_Y * scale}px) scale(${scale})`
        }}
      />
    </span>
  );
}
