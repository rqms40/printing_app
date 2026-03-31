import { describe, expect, it } from "vitest";

import {
  humanizeEnumValue,
  normalizeAdminUser,
  normalizeOrder,
  normalizeServiceAddon,
  normalizeServiceCategory,
  normalizeSpecOption,
} from "./api-normalizers";

describe("api normalizers", () => {
  it("maps camelCase admin orders into the snake_case UI shape", () => {
    const order = normalizeOrder({
      id: 7,
      orderId: "ORD-10007",
      userId: 3,
      category: "paper",
      totalPrice: "120.5",
      deliveryFee: "50",
      paymentMethod: "gcash",
      paymentStatus: "paid",
      orderStatus: "printing_in_progress",
      deliveryOption: "delivery",
      createdAt: "2026-03-31T10:00:00.000Z",
      updatedAt: "2026-03-31T10:30:00.000Z",
      adminNotes: "Rush",
    });

    expect(order).toMatchObject({
      id: "7",
      order_id: "ORD-10007",
      user_id: "3",
      total_price: 120.5,
      delivery_fee: 50,
      payment_status: "paid",
      order_status: "printing_in_progress",
      delivery_option: "delivery",
      admin_notes: "Rush",
      created_at: "2026-03-31T10:00:00.000Z",
      updated_at: "2026-03-31T10:30:00.000Z",
    });
  });

  it("maps product category responses and parses allowed extensions", () => {
    const category = normalizeServiceCategory({
      id: 2,
      name: "Paper Printing",
      slug: "paper",
      description: "Docs",
      icon: "FileTextOutlined",
      baseRate: "12.5",
      maxFileSizeMb: 25,
      allowedExtensions: "[\"pdf\",\"png\"]",
      isActive: true,
      sortOrder: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    expect(category).toMatchObject({
      id: "2",
      base_rate: 12.5,
      max_file_size_mb: 25,
      allowed_extensions: ["pdf", "png"],
      is_active: true,
      sort_order: 1,
    });
  });

  it("maps product spec options and addons into the UI shape", () => {
    const option = normalizeSpecOption({
      id: 5,
      categoryId: 2,
      optionGroup: "paper_size",
      label: "A4",
      value: "a4",
      multiplier: "1.2",
      fixedFee: "0",
      unitCost: "0",
      estimatedGrams: null,
      isDefault: true,
      isActive: true,
      sortOrder: 10,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    const addon = normalizeServiceAddon({
      id: 9,
      categoryId: null,
      name: "Lamination",
      description: "Matte finish",
      price: "35",
      priceType: "flat",
      isActive: true,
      sortOrder: 3,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    expect(option).toMatchObject({
      id: "5",
      category_id: "2",
      option_group: "paper_size",
      fixed_fee: 0,
      is_default: true,
      is_active: true,
    });
    expect(addon).toMatchObject({
      id: "9",
      category_id: undefined,
      price: 35,
      price_type: "flat",
      is_active: true,
      sort_order: 3,
    });
  });

  it("maps admin users and renders safe labels", () => {
    const user = normalizeAdminUser({
      id: 11,
      fullName: "Admin User",
      email: "admin@gridprint.ph",
      phoneNumber: null,
      role: "admin",
      isActive: true,
      isProfileComplete: true,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    expect(user).toMatchObject({
      id: 11,
      full_name: "Admin User",
      is_active: true,
      is_profile_complete: true,
    });
    expect(humanizeEnumValue("ready_for_dispatch")).toBe("Ready For Dispatch");
    expect(humanizeEnumValue(undefined, "Unknown")).toBe("Unknown");
  });
});
