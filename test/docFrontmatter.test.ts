import { describe, test, expect } from "vitest";
import { DocFrontmatterSchema } from "../src/schemas/docFrontmatter.js";
import { z } from "zod";

describe("DocFrontmatterSchema", () => {
  test("valid doc frontmatter parses successfully", () => {
    const input = {
      node_type: "service",
      title: "Test Service",
      service: "my-service",
      status: "active",
      updated: "2025-01-15",
      tags: ["test"],
      links: {},
    };
    const result = DocFrontmatterSchema.parse(input);
    expect(result).toEqual(input);
  });

  test("rejects frontmatter without node_type", () => {
    const input = {
      title: "Test",
      service: "svc",
      status: "active",
      updated: "2025-01-15",
      tags: [],
      links: {},
    };
    expect(() => DocFrontmatterSchema.parse(input)).toThrow(z.ZodError);
  });

  test("rejects frontmatter with invalid status", () => {
    const input = {
      node_type: "service",
      title: "Test",
      service: "svc",
      status: "invalid_status",
      updated: "2025-01-15",
      tags: [],
      links: {},
    };
    expect(() => DocFrontmatterSchema.parse(input)).toThrow(z.ZodError);
  });

  test("rejects frontmatter with non-ISO date format", () => {
    const input = {
      node_type: "service",
      title: "Test",
      service: "svc",
      status: "active",
      updated: "January 15 2025",
      tags: [],
      links: {},
    };
    expect(() => DocFrontmatterSchema.parse(input)).toThrow(z.ZodError);
  });
});
