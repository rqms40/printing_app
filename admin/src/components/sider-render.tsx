import type { RefineLayoutSiderProps } from "@refinedev/ui-types";

type SiderRenderProps = Parameters<
  NonNullable<RefineLayoutSiderProps["render"]>
>[0];

export function renderSiderMenuOnly({
  dashboard,
  items,
}: SiderRenderProps) {
  return (
    <>
      {dashboard}
      {items}
    </>
  );
}
