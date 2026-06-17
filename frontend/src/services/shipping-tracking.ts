export const CUSTOM_COURIER_VALUE = "__custom_courier__";

export const COURIER_OPTIONS = [
  { label: "DHL Express", value: "DHL Express" },
  { label: "FedEx", value: "FedEx" },
  { label: "UPS", value: "UPS" },
  { label: "Vietnam Post", value: "Vietnam Post" },
  { label: "GHN", value: "GHN" },
  { label: "GHTK", value: "GHTK" },
] as const;

function cleanFulfillmentValue(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || /^(pending|pending assignment)$/i.test(trimmed)) {
    return "";
  }

  return trimmed;
}

export function isKnownCourierName(value: string | null | undefined): boolean {
  const courierName = cleanFulfillmentValue(value).toLowerCase();

  return COURIER_OPTIONS.some(
    (option) => option.value.toLowerCase() === courierName,
  );
}

export function getCourierSelectValue(
  courierName: string | null | undefined,
): string {
  const cleanedCourierName = cleanFulfillmentValue(courierName);

  if (!cleanedCourierName) {
    return "";
  }

  const matchingOption = COURIER_OPTIONS.find(
    (option) =>
      option.value.toLowerCase() === cleanedCourierName.toLowerCase(),
  );

  return matchingOption?.value ?? CUSTOM_COURIER_VALUE;
}

export function buildTrackingUrl(
  courierName: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  const code = cleanFulfillmentValue(trackingNumber);

  if (!code) {
    return null;
  }

  const encodedCode = encodeURIComponent(code);
  const courier = cleanFulfillmentValue(courierName).toLowerCase();

  if (courier.includes("dhl")) {
    return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodedCode}`;
  }

  if (courier.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodedCode}`;
  }

  if (courier.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodedCode}`;
  }

  const query = encodeURIComponent(
    [cleanFulfillmentValue(courierName), code, "tracking"]
      .filter(Boolean)
      .join(" "),
  );

  return `https://www.google.com/search?q=${query}`;
}
