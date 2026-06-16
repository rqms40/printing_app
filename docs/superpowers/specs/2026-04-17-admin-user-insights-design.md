# Admin User Insights Design

Date: 2026-04-17
Branch: `codex/refresh-and-current-changes`

## Goal

Improve the admin experience around user understanding by:

- adding a dedicated admin user detail/show page
- making the users list page navigable into that detail view
- adding a customer-focused `Users` analytics tab to the existing dashboard

This should let admins inspect an individual user profile quickly and also understand aggregate customer demographics, profile completion, preferences, and customer segment behavior from the dashboard.

## Current Context

The current admin app already has:

- a working Refine + React Router + Ant Design admin shell in `admin/`
- a `/users` list page backed by `GET /admin/users`
- a dashboard page with KPI cards and analytics charts
- backend admin endpoints in `server/src/admin/admin.controller.ts`

The current gaps are:

- the users page has no dedicated show/detail route
- there is no backend endpoint for a single user admin view
- there is no users analytics payload for the dashboard
- the admin dashboard is mostly operations/orders focused

## Product Decisions

### Chosen Scope

The approved v1 scope is:

- `User Show + Dashboard Users tab`
- analytics should include both profile data and order behavior
- analytics should focus primarily on customers
- riders and admins should still appear in high-level role counts
- user details should open as a dedicated show page, not a modal or drawer

### Recommended Approach

Use a dedicated backend-supported user detail endpoint plus a dedicated backend-supported users analytics endpoint.

Why this approach:

- keeps the admin frontend mostly presentational
- avoids duplicating analytics derivation logic in the UI
- gives the show page a stable contract
- fits the existing Refine routing/resource model cleanly
- scales better than deriving everything from `/admin/users` on the client

## Information Architecture

### Users List

Keep `/users` as the operational table for scanning and searching users.

Add:

- row-level `View` action
- optional clickable row behavior to open the show page

Keep existing list responsibilities:

- search
- role and status scanning
- profile and preference summary in table cells

Do not turn the list itself into a dense analytics surface.

### User Show Page

Add a new route:

`/users/show/:id`

Purpose:

- give admins a dossier-like user profile page
- emphasize summary, context, and recent behavior
- keep it read-heavy rather than editable

### Dashboard Users Tab

Extend the existing dashboard page with a top-level tab group:

- `Operations`
- `Orders`
- `Users`

The new `Users` tab should be summary-first and customer-focused.

It should not replace the `/users` list page. It complements it.

## UX Design

### Users List

The users list remains table-first.

Recommended row structure:

- avatar + name + email
- phone
- profile chips
- print-focus chips
- role
- active/inactive status
- joined date
- `View` action

The `View` action should feel explicit and reliable even if row click navigation is also enabled.

### User Show Page Layout

The show page should use four stacked blocks:

1. `Hero summary`
2. `Quick metrics`
3. `Profile summary`
4. `Recent orders`

#### Hero Summary

Show:

- avatar
- full name
- email
- phone number
- role
- profile completion badge
- joined date
- last updated date

#### Quick Metrics

Show compact admin-facing cards:

- total orders
- paid orders
- total spend
- average order value
- last order date
- last paid order date

These metrics should be derived from persisted orders, not mocked in the UI.

#### Profile Summary

Show the profiling data introduced in the mobile/customer flow:

- category
- field
- course
- organization
- gender
- date of birth
- print preferences

If fields are missing, render explicit placeholders such as:

- `No course provided`
- `No organization provided`
- `No print preferences yet`

Do not hide the whole section when data is sparse.

#### Recent Orders

Show the most recent five orders with:

- order id
- category
- order status
- payment status
- total price
- created date

This keeps the page useful without turning it into a full order management replacement.

### Dashboard Users Tab Layout

The `Users` tab should use a three-row rhythm.

#### Row 1: KPI Cards

- total customers
- new customers in selected period
- profile completion rate
- active customers in selected period

Riders and admins should still appear as supporting totals somewhere in the tab, but not dominate it.

#### Row 2: Trend + Demographics

- signup trend chart
- category split (`student` vs `professional`)
- field mix

#### Row 3: Segments + Preference/Behavior

- top customer segments (`category + field`)
- preference mix
- dormant vs active customer split
- top segments by revenue

## Visual Direction

Preserve the current admin visual language:

- dark cards
- yellow highlight for primary emphasis
- blue/green support colors for secondary metrics
- clean grid layout, not a generic white BI console

The new user surfaces should feel like a natural expansion of the current GRIDGO admin, not a separate design system.

## Backend Design

### New/Extended Endpoints

Add or extend:

- `GET /admin/users`
- `GET /admin/users/:id`
- `GET /admin/users/analytics?period=7D|30D|6M`

The existing `GET /admin/users` stays as the list source.

### User Detail Contract

`GET /admin/users/:id`

Response shape:

```json
{
  "user": {
    "id": 1,
    "full_name": "Maria Santos",
    "email": "maria@gridgoprint.ph",
    "phone_number": "+639171234567",
    "role": "customer",
    "is_active": true,
    "is_profile_complete": true,
    "profile_category": "student",
    "profile_field": "architecture",
    "course": "BS Architecture",
    "organization": "Mapua University",
    "gender": "female",
    "date_of_birth": "1995-06-15T00:00:00.000Z",
    "printing_preferences": ["plotting_blueprints", "high_res_color"],
    "created_at": "2026-04-10T10:00:00.000Z",
    "updated_at": "2026-04-17T05:00:00.000Z"
  },
  "summary": {
    "total_orders": 12,
    "paid_orders": 10,
    "total_spend": 4820,
    "avg_order_value": 402,
    "last_order_at": "2026-04-16T08:00:00.000Z",
    "last_paid_at": "2026-04-16T08:00:00.000Z"
  },
  "recent_orders": [
    {
      "id": 21,
      "order_id": "ORD-10021",
      "category": "paper",
      "order_status": "delivered",
      "payment_status": "paid",
      "total_price": 220,
      "created_at": "2026-04-16T08:00:00.000Z"
    }
  ]
}
```

### Users Analytics Contract

`GET /admin/users/analytics?period=7D|30D|6M`

Response shape:

```json
{
  "totals": {
    "customers": 124,
    "riders": 8,
    "admins": 2,
    "new_customers": 18,
    "profile_completion_rate": 82,
    "active_customers": 88,
    "dormant_customers": 36
  },
  "signup_trend": [
    { "label": "Apr 11", "value": 3 }
  ],
  "category_mix": [
    { "label": "Student", "value": 79 },
    { "label": "Professional", "value": 45 }
  ],
  "field_mix": [
    { "label": "Architecture", "value": 35 }
  ],
  "segment_mix": [
    { "label": "Student / Architecture", "value": 28 }
  ],
  "preference_mix": [
    { "label": "Plotting / Blueprints", "value": 42 }
  ],
  "segment_revenue": [
    { "label": "Student / Architecture", "value": 18200 }
  ]
}
```

### Analytics Definitions

#### Customer Focus

All demographic and segment breakdowns should be based on `role === customer`.

Riders and admins should only contribute to high-level totals.

#### New Customers

Count customers created within the selected period.

#### Profile Completion Rate

Percentage of customers with `is_profile_complete = true`.

#### Active Customers

Customers with at least one order created within the selected period.

#### Dormant Customers

Customers with no orders in the selected period.

#### Category Mix

Distribution of customer `profile_category`.

#### Field Mix

Distribution of customer `profile_field`.

#### Segment Mix

Distribution of combined `profile_category + profile_field`.

#### Preference Mix

Aggregate count of `printing_preferences` across customers.

#### Segment Revenue

Sum of paid order totals grouped by customer segment.

Only paid orders should count toward revenue.

## Backend Code Organization

The current `AdminController` already contains dashboard and analytics logic. This work should avoid turning it into an even larger all-purpose file.

Recommended structure:

- keep route definitions in `admin.controller.ts`
- extract user analytics helpers into a focused file or service
- extract user detail mapping helpers if needed

This keeps the controller thin enough while preserving existing admin patterns.

## Frontend Design

### Refine Resources And Routes

Extend the `users` resource so it supports a show route in addition to list:

- `list: /users`
- `show: /users/show/:id`

Add a new page component:

- `admin/src/pages/users/show.tsx`

### Users List Enhancements

Keep the current table, but add:

- a `View` action
- optional row navigation to the show page

This should not force a redesign of the whole list page.

### User Show Page Components

Recommended split:

- main page component for data loading and layout
- small presentation blocks for:
  - hero summary
  - quick metrics
  - profile summary
  - recent orders

Do not dump everything into a single oversized `show.tsx` file if the responsibilities start to blur.

### Dashboard Users Tab

Do not create a separate `/users/analytics` page in v1.

Recommended implementation:

- keep the current `DashboardPage`
- add a tab control at the page level
- move current charts/ops content into named tab sections
- add a dedicated `Users` tab block that consumes the new analytics contract

If `dashboard/index.tsx` becomes too large, extract:

- users analytics contract/normalizer
- chart blocks/components
- users KPI row component

## Failure States

### User Show Page Failure

If `/admin/users/:id` fails:

- show an explicit admin error state
- provide `Retry`
- provide `Back to Users`

Do not fall back to fake user detail data.

### Users Analytics Failure

If `/admin/users/analytics` fails:

- keep the rest of the dashboard functional
- show an inline error card inside the `Users` tab
- provide `Retry`

Do not fabricate analytics rows or fake charts.

### Partial Data

If a user has missing profile fields:

- render placeholders
- preserve layout
- do not collapse the section

If analytics returns empty series:

- render empty-state cards/charts
- do not collapse the tab layout

## Testing Strategy

### Backend Tests

Add controller/service coverage for:

- `GET /admin/users/:id`
- `GET /admin/users/analytics`

Verify:

- customer-only analytics focus
- riders/admins still included in totals
- category aggregation
- field aggregation
- segment aggregation
- preference aggregation
- active vs dormant customer logic
- segment revenue derived only from paid customer orders

### Frontend Tests

Users list:

- renders `View` action
- navigates to show route correctly

User show page:

- renders hero summary
- renders quick metrics
- renders profile summary
- renders recent orders
- handles sparse profile data
- handles fetch failure state

Dashboard users tab:

- renders KPI cards and charts from analytics payload
- renders empty state when analytics is empty
- renders explicit error state on analytics failure

## Non-Goals For V1

Do not include in this implementation:

- user editing from the admin show page
- export/CSV tooling
- advanced cohort retention analysis
- separate `/users/analytics` route
- rider/admin deep-dive analytics beyond counts
- full customer timeline/audit trail beyond recent orders

## Success Criteria

This work is successful when:

- admins can open a dedicated user show page from `/users`
- the show page exposes the stored user profiling fields clearly
- admins can see customer-focused user analytics in a `Users` dashboard tab
- analytics are derived from real backend data, not fake frontend fallbacks
- sparse and failure states are explicit and usable

