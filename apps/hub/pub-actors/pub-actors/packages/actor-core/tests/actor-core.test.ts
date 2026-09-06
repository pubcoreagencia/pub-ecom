import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  PubActorDiagnosticSchema,
  PubActorDiagnostic,
  BasePubActor,
  redactSensitive,
  inspectRecordFields,
} from "../src/index.js";

describe("PUB Actor Core Standard", () => {
  it("should redact sensitive tokens and credentials from logs", () => {
    const sensitive = "Starting actor with apify_api_1234567890abcdef and Bearer secret_token_999";
    const cleaned = redactSensitive(sensitive);
    expect(cleaned).not.toContain("apify_api_1234567890abcdef");
    expect(cleaned).not.toContain("secret_token_999");
    expect(cleaned).toContain("[REDACTED_SECRET]");
  });

  it("should validate and conform to standard PubActorDiagnosticSchema", () => {
    const sampleDiag: PubActorDiagnostic = {
      success: true,
      source: "google_maps",
      sourceUrl: "https://maps.google.com/?q=dentistas",
      extractionMethod: "places_internal_api",
      statusCode: 200,
      finalUrl: "https://maps.google.com/?q=dentistas",
      recordsFound: 10,
      recordsValid: 10,
      fieldsFound: ["name", "address", "phone", "rating"],
      fieldsMissing: [],
      blocked: false,
      blockReason: null,
      durationMs: 1450,
      error: null,
    };

    const parsed = PubActorDiagnosticSchema.safeParse(sampleDiag);
    expect(parsed.success).toBe(true);
  });

  it("should inspect required and optional fields correctly", () => {
    const record = {
      name: "Clínica Dental",
      address: "Rua das Flores 100",
      phone: null,
    };

    const inspection = inspectRecordFields(record, ["name", "address"], ["phone", "website"]);
    expect(inspection.fieldsFound).toContain("name");
    expect(inspection.fieldsFound).toContain("address");
    expect(inspection.fieldsFound).not.toContain("phone");
    expect(inspection.isValid).toBe(true);

    const inspectionWithMissing = inspectRecordFields(record, ["name", "phone"], ["website"]);
    expect(inspectionWithMissing.fieldsMissing).toContain("phone");
    expect(inspectionWithMissing.isValid).toBe(false);
  });

  it("should enforce standard lifecycle and reject mock items in BasePubActor", async () => {
    interface TestInput {
      url: string;
      maxItems: number;
    }
    interface TestProduct {
      id: string;
      title: string;
      _mock?: boolean;
    }

    class MockRejectionActor extends BasePubActor<TestInput, TestProduct> {
      validateInput(rawInput: unknown): TestInput {
        return z.object({ url: z.string().url(), maxItems: z.number().default(5) }).parse(rawInput);
      }

      isMockOrInvalid(item: TestProduct): boolean {
        return item._mock === true;
      }

      async executeInternal(input: TestInput, diagnostic: PubActorDiagnostic) {
        diagnostic.statusCode = 200;
        diagnostic.extractionMethod = "test_extraction";
        return {
          data: [
            { id: "1", title: "Real Product", _mock: false },
            { id: "2", title: "Fake Product", _mock: true },
          ],
          diagnostic,
        };
      }
    }

    const actor = new MockRejectionActor("test/mock-rejection", "1.0.0", "test");
    const result = await actor.run({ url: "https://example.com/test", maxItems: 2 });

    expect(result.diagnostic.recordsFound).toBe(2);
    expect(result.diagnostic.recordsValid).toBe(1); // Only 1 real product
    expect(result.diagnostic.success).toBe(true);
    expect(result.metadata.actorName).toBe("test/mock-rejection");
  });

  it("should capture runtime errors into diagnostic object gracefully", async () => {
    class FailingActor extends BasePubActor<any, any> {
      validateInput(rawInput: unknown) {
        return rawInput;
      }
      isMockOrInvalid() {
        return false;
      }
      async executeInternal() {
        throw new Error("Target service returned 503 Service Unavailable");
      }
    }

    const actor = new FailingActor("test/failing", "1.0.0", "test");
    const result = await actor.run({ url: "https://example.com" });

    expect(result.diagnostic.success).toBe(false);
    expect(result.diagnostic.error).toContain("503 Service Unavailable");
    expect(result.data).toEqual([]);
  });
});
