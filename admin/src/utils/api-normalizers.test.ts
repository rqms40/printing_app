import { describe, expect, it } from "vitest";

import {
  humanizeEnumValue,
  normalizeAdminUser,
  normalizeOrder,
  normalizeProductSpecDefinition,
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

  it("preserves order destination snapshots and coordinates", () => {
    const order = normalizeOrder({
      id: 7,
      order_id: "ORD-10007",
      user_id: 1,
      category: "paper",
      total_price: 2,
      delivery_fee: 0,
      payment_method: "gcash",
      payment_status: "pending",
      order_status: "order_placed",
      delivery_option: "delivery",
      delivery_address: {
        label: "Test",
        full_address: "Test",
        city: "Test",
        landmark: "Test",
        latitude: 7.0713113,
        longitude: 125.6123279,
      },
      destinations: [
        {
          id: 1,
          label: "Drop 1",
          full_address: "Drop one",
          city: "Davao City",
          latitude: "7.0713113",
          longitude: "125.6123279",
        },
        {
          id: 2,
          label: "Drop 2",
          full_address: "Drop two",
          city: "Davao City",
          latitude: "7.0900000",
          longitude: "125.6200000",
        },
      ],
      created_at: "2026-05-02T19:00:36.788Z",
      updated_at: "2026-05-02T19:00:36.788Z",
    });

    expect(order.delivery_address).toMatchObject({
      label: "Test",
      full_address: "Test",
      city: "Test",
      landmark: "Test",
      latitude: 7.0713113,
      longitude: 125.6123279,
    });
    expect(order.destinations).toEqual([
      expect.objectContaining({
        id: 1,
        label: "Drop 1",
        full_address: "Drop one",
        latitude: 7.0713113,
        longitude: 125.6123279,
      }),
      expect.objectContaining({
        id: 2,
        label: "Drop 2",
        full_address: "Drop two",
        latitude: 7.09,
        longitude: 125.62,
      }),
    ]);
  });

  it("maps product category responses and parses allowed extensions", () => {
    const category = normalizeServiceCategory({
      id: 2,
      name: "Paper Printing",
      slug: "paper",
      description: "Docs",
      mobileDescription: "Mobile docs",
      icon: "FileTextOutlined",
      fileProcessingType: "document",
      pricingModel: "per_page_modifiers",
      baseRate: "12.5",
      quantityUnit: "page",
      maxFileSizeMb: 25,
      allowedExtensions: "[\"pdf\",\"png\"]",
      specs: [
        {
          id: 8,
          categoryId: 2,
          key: "paper_size",
          label: "Paper Size",
          inputType: "select",
          valueType: "string",
          pricingRole: "multiplier",
        },
      ],
      isActive: true,
      sortOrder: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    expect(category).toMatchObject({
      id: "2",
      mobile_description: "Mobile docs",
      file_processing_type: "document",
      pricing_model: "per_page_modifiers",
      base_rate: 12.5,
      quantity_unit: "page",
      max_file_size_mb: 25,
      allowed_extensions: ["pdf", "png"],
      specs: [{ id: "8", key: "paper_size", pricing_role: "multiplier" }],
      is_active: true,
      sort_order: 1,
    });
  });

  it("maps product spec definitions, options, and addons into the UI shape", () => {
    const spec = normalizeProductSpecDefinition({
      id: 4,
      categoryId: 2,
      key: "material",
      label: "Material",
      helpText: "Choose a filament",
      inputType: "select",
      valueType: "string",
      isRequired: true,
      isActive: false,
      defaultValue: "pla",
      pricingRole: "unit_cost",
      unitLabel: "g",
      minValue: null,
      maxValue: "100",
      stepValue: "0.5",
      sortOrder: 20,
      options: [],
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    const option = normalizeSpecOption({
      id: 5,
      specDefinitionId: 4,
      specDefinition: {
        id: 4,
        categoryId: 2,
        key: "material",
      },
      label: "A4",
      value: "a4",
      multiplier: "1.2",
      fixedFee: "0",
      unitCost: "0",
      estimatedQuantity: "42",
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

    expect(spec).toMatchObject({
      id: "4",
      category_id: "2",
      key: "material",
      is_active: false,
      pricing_role: "unit_cost",
      max_value: 100,
      step_value: 0.5,
    });
    expect(option).toMatchObject({
      id: "5",
      category_id: "2",
      spec_definition_id: "4",
      option_group: "material",
      fixed_fee: 0,
      estimated_quantity: 42,
      estimated_grams: 42,
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
      profileCategory: "professional",
      profileField: "business_corporate",
      course: "Operations",
      organization: "Grid Print HQ",
      printingPreferences: ["marketing_materials"],
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-15T00:00:00.000Z",
    });

    expect(user).toMatchObject({
      id: 11,
      full_name: "Admin User",
      is_active: true,
      is_profile_complete: true,
      profile_category: "professional",
      profile_field: "business_corporate",
      course: "Operations",
      organization: "Grid Print HQ",
      printing_preferences: ["marketing_materials"],
    });
    expect(humanizeEnumValue("ready_for_dispatch")).toBe("Ready For Dispatch");
    expect(humanizeEnumValue(undefined, "Unknown")).toBe("Unknown");
  });
});
