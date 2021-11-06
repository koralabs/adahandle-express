import { ALLOWED_CHAR, BETA_PHASE_MATCH } from "./constants";

export const isValid = (handle: string) =>
  !!handle.match(ALLOWED_CHAR) && handle.match(BETA_PHASE_MATCH) && handle.length <= 15;

export const normalizeNFTHandle = (handle: string): string => handle.toLowerCase();

export type RarityType = "Legendary" | "Ultra Rare" | "Rare" | "Common" | "Basic";
export type RarityColorTypes = "white" | "blue" | "green" | "red";
export type RarityCostTypes = null | 500 | 100 | 50 | 10;
export type RarityHexTypes = "#ffffff" | "#48ACF0" | "#0CD15B" | "#DF3737";

export const getRarityFromLength = (length: number): RarityType => {
    if (1 === length) {
      return 'Legendary';
    }

    if (2 === length) {
      return 'Ultra Rare';
    }

    if (3 === length) {
      return 'Rare';
    }

    if (length > 3 && length < 8) {
      return 'Common';
    }

    return 'Basic';
}

export const getRaritySlug = (handle: string): RarityType =>
  getRarityFromLength(handle.length);

export const getRarityColor = (handle: string): RarityColorTypes => {
  const rarity = getRarityFromLength(handle.length);
  switch (rarity) {
    case "Legendary":
      return "red";
    case "Ultra Rare":
      return "green";
    case "Rare":
      return "blue";
    default:
    case "Common":
      return "white";
  }
};

export const getRarityHex = (handle: string): RarityHexTypes => {
  const rarity = getRarityFromLength(handle.length);
  switch (rarity) {
    case "Legendary":
      return "#DF3737";
    case "Ultra Rare":
      return "#0CD15B";
    case "Rare":
      return "#48ACF0";
    default:
    case "Common":
      return "#ffffff";
  }
};

export const getRarityCost = (handle: string): RarityCostTypes => {
  const rarity = getRarityFromLength(handle.length);
  switch (rarity) {
    case "Legendary":
      return null;
    case "Ultra Rare":
      return 500;
    case "Rare":
      return 100;
    case "Common":
      return 50;
    case "Basic":
      return 10;
  }
};
