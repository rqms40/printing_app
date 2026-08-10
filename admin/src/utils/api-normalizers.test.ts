import { describe, expect, it } from "vitest";

import {
  humanizeEnumValue,
  normalizeAdminUser,
  normalizeAdminRider,
  normalizeDispatchPlan,
  normalizeOrder,
  normalizeProductSpecDefinition,
  normalizeServiceAddon,
  normalizeServiceCategory,
  normalizeSpecOption,
} from "./api-normalizers";

const validDispatchStop = (overrides: Record<string, unknown> = {}) => ({
  id: 21,
  planId: 12,
  assignmentId: 201,
  sequence: 1,
  status: "pending",
  destinationLatitude: 7.071,
  destinationLongitude: 125.612,
  legDurationSeconds: 10,
  legDistanceMeters: 100,
  legGeometry: {
    type: "LineString",
    coordinates: [[125.6079, 7.064], [125.612, 7.071]],
  },
  ...overrides,
});

const validDispatchPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  riderId: 10,
  version: 1,
  status: "active",
  originLatitude: 7.064,
  originLongitude: 125.6079,
  provider: "osrm",
  profile: "driving",
  totalDurationSeconds: 10,
  totalDistanceMeters: 100,
  routingDataStale: false,
  plannedAt: "2026-07-10T10:00:00.000Z",
  stops: [validDispatchStop()],
  ...overrides,
});

describe("api normalizers", () => {
  it("preserves only server-provided admin status capabilities", () => {
    const order = normalizeOrder({
      id: 7,
      order_id: "ORD-10007",
      user_id: 3,
      category: "paper",
      total_price: 20,
      delivery_fee: 0,
      payment_method: "grid_credits",
      payment_status: "paid",
      order_status: "submitted",
      allowed_next_statuses: ["approved_for_matching", "file_rejected"],
      delivery_option: "delivery",
      created_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:00:00.000Z",
    });

    expect(order.allowed_next_statuses).toEqual([
      "approved_for_matching",
      "file_rejected",
    ]);
  });

  it("preserves server-computed rider assignment eligibility", () => {
    expect(
      normalizeAdminRider({
        id: 10,
        user_id: 20,
        full_name: "Juan Rider",
        vehicle_type: "motorcycle",
        is_available: true,
        assignment_eligible: false,
      }),
    ).toMatchObject({
      id: 10,
      is_available: true,
      assignment_eligible: false,
    });
  });

  it("strictly normalizes persisted dispatch plans and orders stops by sequence", () => {
    const plan = normalizeDispatchPlan({
      id: "12",
      riderId: "10",
      version: "2",
      status: "active",
      originLatitude: "7.0640000",
      originLongitude: "125.6079000",
      provider: "osrm",
      profile: "driving",
      totalDurationSeconds: "352",
      totalDistanceMeters: "2188",
      routingDataStale: false,
      plannedAt: "2026-07-10T10:00:00.000Z",
      stops: [
        {
          id: "22",
          planId: "12",
          assignmentId: "202",
          sequence: "2",
          status: "pending",
          destinationLatitude: "7.0900000",
          destinationLongitude: "125.6200000",
          legDurationSeconds: "170",
          legDistanceMeters: "1134",
          legGeometry: {
            type: "LineString",
            coordinates: [[125.612, 7.071], [125.62, 7.09]],
          },
          assignment: { order: { orderId: "ORD-MARK" } },
        },
        {
          id: 21,
          planId: 12,
          assignmentId: 201,
          sequence: 1,
          status: "pending",
          destinationLatitude: 7.071,
          destinationLongitude: 125.612,
          legDurationSeconds: 182,
          legDistanceMeters: 1054,
          legGeometry: {
            type: "LineString",
            coordinates: [[125.6079, 7.064], [125.612, 7.071]],
          },
          assignment: { order: { orderId: "ORD-VEN" } },
        },
      ],
    });

    expect(plan).toMatchObject({
      id: 12,
      rider_profile_id: 10,
      version: 2,
      provider: "osrm",
      profile: "driving",
      total_duration_seconds: 352,
      total_distance_meters: 2188,
      routing_data_stale: false,
      stops: [
        { sequence: 1, assignment_id: 201, order_ref: "ORD-VEN" },
        { sequence: 2, assignment_id: 202, order_ref: "ORD-MARK" },
      ],
    });
  });

  it.each([
    [{ type: "Polygon", coordinates: [] }, "LineString"],
    [{ type: "LineString", coordinates: [["125.6", 7.06]] }, "coordinate"],
    [{ type: "LineString", coordinates: [[125.6]] }, "coordinate"],
  ])("rejects malformed persisted route geometry %#", (geometry, message) => {
    expect(() =>
      normalizeDispatchPlan(validDispatchPlan({
        stops: [validDispatchStop({ legGeometry: geometry })],
      })),
    ).toThrow(message);
  });

  it.each([
    [validDispatchPlan({ stops: [] }), "stops"],
    [validDispatchPlan({ plannedAt: "not-a-date" }), "timestamp"],
    [validDispatchPlan({ originLatitude: 91 }), "metrics"],
    [validDispatchPlan({ stops: [validDispatchStop({ destinationLongitude: 181 })] }), "coordinate"],
    [
      validDispatchPlan({
        stops: [
          validDispatchStop(),
          validDispatchStop({ id: 22, sequence: 2 }),
        ],
      }),
      "assignment",
    ],
  ])("rejects invalid persisted dispatch invariants %#", (payload, message) => {
    expect(() => normalizeDispatchPlan(payload)).toThrow(message);
  });

  it.each([
    validDispatchPlan({ routingDataStale: undefined }),
    validDispatchPlan({ routingDataStale: "unknown" }),
  ])("requires an explicit persisted routing stale flag", (payload) => {
    expect(() => normalizeDispatchPlan(payload)).toThrow("stale");
  });
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
      orderStatus: "production",
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
      order_status: "production",
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
      order_status: "submitted",
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

  it("preserves assigned rider contact details", () => {
    const order = normalizeOrder({
      id: 7,
      order_id: "ORD-10007",
      user_id: 1,
      category: "paper",
      total_price: 2,
      delivery_fee: 0,
      payment_method: "gcash",
      payment_status: "pending",
      order_status: "rider_assigned",
      delivery_option: "delivery",
      assigned_rider_contact: {
        user_id: 70,
        rider_profile_id: 7,
        display_name: "Maya Santos",
        phone_number: "+639171234567",
        vehicle_type: "motorcycle",
        plate_number: "ABC 1234",
        delivery_assignment_id: 99,
        delivery_status: "accepted",
      },
      created_at: "2026-05-02T19:00:36.788Z",
      updated_at: "2026-05-02T19:00:36.788Z",
    });

    expect(order.assigned_rider_contact).toEqual({
      user_id: "70",
      rider_profile_id: "7",
      display_name: "Maya Santos",
      full_name: undefined,
      nickname: undefined,
      phone_number: "+639171234567",
      vehicle_type: "motorcycle",
      plate_number: "ABC 1234",
      delivery_assignment_id: "99",
      delivery_status: "accepted",
    });
  });

  it("preserves proof of delivery metadata for admin review", () => {
    const order = normalizeOrder({
      id: 7,
      order_id: "ORD-10007",
      user_id: 1,
      category: "paper",
      total_price: 2,
      delivery_fee: 0,
      payment_method: "gcash",
      payment_status: "paid",
      order_status: "delivered",
      delivery_option: "delivery",
      delivery_proof: {
        type: "photo",
        file_id: 55,
        object_key: "uploads/pod/55.jpg",
        captured_at: "2026-05-02T19:00:36.788Z",
        captured_by_rider_id: 7,
      },
      created_at: "2026-05-02T19:00:36.788Z",
      updated_at: "2026-05-02T19:00:36.788Z",
    });

    expect((order as any).delivery_proof).toEqual({
      type: "photo",
      file_id: 55,
      object_key: "uploads/pod/55.jpg",
      signature_data: undefined,
      captured_at: "2026-05-02T19:00:36.788Z",
      captured_by_rider_id: 7,
    });
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
      allowedExtensions: '["pdf","png"]',
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
      email: "admin@gridgo.ph",
      phoneNumber: null,
      role: "admin",
      isActive: true,
      isProfileComplete: true,
      profileCategory: "professional",
      profileField: "business_corporate",
      course: "Operations",
      organization: "Grid Print HQ",
      clientAccountType: "business",
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
      client_account_type: "business",
      printing_preferences: ["marketing_materials"],
    });
    expect(humanizeEnumValue("ready_for_dispatch")).toBe("Ready For Dispatch");
    expect(humanizeEnumValue(undefined, "Unknown")).toBe("Unknown");
  });
});
