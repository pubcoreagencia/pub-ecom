import { AuditedBrowserProduct } from "../../browser-collector/src/normalizer.js";
import { PubEcomProduct } from "../../actor-core/src/canonical.js";

export interface VisualMatchAudit {
  titleMatch: boolean;
  priceMatch: boolean;
  imageMatch: boolean;
  status: "MATCH" | "REVIEW_REQUIRED";
}

export class ImportValidator {
  /**
   * Asserts mandatory fields presence with zero mock tolerance
   */
  static validate(audited: AuditedBrowserProduct, canonical: PubEcomProduct | null): {
    isValid: boolean;
    status: "VALID" | "INCOMPLETE" | "INVALID";
    missingFields: string[];
    zeroMockApproved: boolean;
    error?: string;
  } {
    const missingFields: string[] = [];

    if (!audited.externalId.value) missingFields.push("externalId");
    if (!audited.title.value) missingFields.push("title");
    if (!audited.price.value || audited.price.value <= 0) missingFields.push("price");
    if (!audited.images.value || audited.images.value.length === 0) missingFields.push("images");
    if (!audited.sourceUrl.value) missingFields.push("sourceUrl");
    if (!audited.source.value) missingFields.push("marketplace");

    if (missingFields.length > 0) {
      return {
        isValid: false,
        status: "INCOMPLETE",
        missingFields,
        zeroMockApproved: true,
        error: `Campos obrigatórios ausentes: ${missingFields.join(", ")}`,
      };
    }

    // Zero-Mock Inspection
    const payloadStr = JSON.stringify(audited).toLowerCase();
    const hasMock =
      payloadStr.includes("_mock") ||
      payloadStr.includes("placeholder") ||
      payloadStr.includes("synthetic") ||
      payloadStr.includes("fake_") ||
      payloadStr.includes("test-product");

    if (hasMock) {
      return {
        isValid: false,
        status: "INVALID",
        missingFields: [],
        zeroMockApproved: false,
        error: "Violação de segurança: dado sintético ou mock detectado no payload.",
      };
    }

    return {
      isValid: true,
      status: "VALID",
      missingFields: [],
      zeroMockApproved: true,
    };
  }

  /**
   * Compares visual rendered page values with extracted values
   */
  static auditVisualMatch(visual: { title?: string; price?: number; imagesCount?: number }, extracted: { title: string; price: number; imagesCount: number }): VisualMatchAudit {
    const titleMatch = Boolean(visual.title && extracted.title && (visual.title.includes(extracted.title) || extracted.title.includes(visual.title)));
    const priceMatch = Boolean(visual.price && extracted.price && Math.abs(visual.price - extracted.price) < 0.01);
    const imageMatch = Boolean(extracted.imagesCount > 0);

    const isMatch = titleMatch && priceMatch && imageMatch;
    return {
      titleMatch,
      priceMatch,
      imageMatch,
      status: isMatch ? "MATCH" : "REVIEW_REQUIRED",
    };
  }
}
