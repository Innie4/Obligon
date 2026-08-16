const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const figmaAsset = (name: string) => `${basePath}/assets/figma/${name}`;

export const assets = {
  arrowUpRight: figmaAsset("arrow-up-right.svg"),
  checkGreen: figmaAsset("check-green.svg"),
  checkLarge: figmaAsset("check-large.svg"),
  checkSmall: figmaAsset("check-small.svg"),
  chevronDown: figmaAsset("chevron-down.svg"),
  droplet: figmaAsset("droplet.svg"),
  facebook: figmaAsset("facebook.svg"),
  fuelvistaCard: figmaAsset("fuelvista-card.png"),
  linkedin: figmaAsset("linkedin.svg"),
  mapPin: figmaAsset("map-pin.svg"),
  obligonLogo: figmaAsset("obligon-logo.png"),
  obligonMark: figmaAsset("obligon-mark.png"),
  socialAt: figmaAsset("social-at.svg"),
  socialGlobe: figmaAsset("social-globe.svg"),
  truck: figmaAsset("truck.svg"),
  zap: figmaAsset("zap.svg")
} as const;
