import { describe, expect, it } from "vitest";
import React from "react";

import { renderSiderMenuOnly } from "./sider-render";

describe("renderSiderMenuOnly", () => {
  it("omits the logout content while preserving dashboard and items", () => {
    const items = [<div key="orders">Orders</div>, <div key="users">Users</div>];
    const dashboard = <div key="dashboard">Dashboard</div>;
    const logout = <div key="logout">Logout</div>;

    const result = renderSiderMenuOnly({
      items,
      dashboard,
      logout,
      collapsed: false,
    });

    const children = React.Children.toArray((result as React.ReactElement).props.children);
    const labels = children.map((child) =>
      React.isValidElement(child) ? child.props.children : child,
    );

    expect(children).toHaveLength(3);
    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Orders");
    expect(labels).toContain("Users");
    expect(labels).not.toContain("Logout");
  });
});
