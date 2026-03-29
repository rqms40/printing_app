import { List } from "@refinedev/antd";
import { Table, Tag, Typography, Button, Space, Input, Switch, Tooltip } from "antd";
import { EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useState } from "react";
import { formatCurrency } from "@/utils/format";

const { Text } = Typography;

const mockProducts = [
  { id: "1", name: "Document Printing (A4)", category: "paper", base_price: 5, unit: "per page", description: "Standard A4 document printing", is_active: true },
  { id: "2", name: "Document Printing (A3)", category: "paper", base_price: 15, unit: "per page", description: "Large format A3 documents", is_active: true },
  { id: "3", name: "Poster Printing (A1)", category: "paper", base_price: 120, unit: "per piece", description: "Full-color poster printing", is_active: true },
  { id: "4", name: "Photo Printing (Glossy)", category: "paper", base_price: 25, unit: "per piece", description: "High-quality glossy photo prints", is_active: true },
  { id: "5", name: "Business Cards (100pcs)", category: "paper", base_price: 350, unit: "per set", description: "Premium matte business cards", is_active: true },
  { id: "6", name: "3D Print - PLA Standard", category: "3d", base_price: 50, unit: "per 10g", description: "Per 10g of PLA material", is_active: true },
  { id: "7", name: "3D Print - ABS Standard", category: "3d", base_price: 65, unit: "per 10g", description: "Per 10g of ABS material", is_active: true },
  { id: "8", name: "3D Print - PETG Premium", category: "3d", base_price: 80, unit: "per 10g", description: "Per 10g of PETG material", is_active: false },
  { id: "9", name: "Spiral Binding", category: "paper", base_price: 45, unit: "per bind", description: "Add spiral binding to any document", is_active: true },
  { id: "10", name: "Lamination (A4)", category: "paper", base_price: 20, unit: "per sheet", description: "Matte or glossy lamination", is_active: true },
];

type MockProduct = (typeof mockProducts)[0];

export function ProductList() {
  const [search, setSearch] = useState("");

  const filtered = search
    ? mockProducts.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : mockProducts;

  const activeCount = mockProducts.filter((p) => p.is_active).length;

  return (
    <List
      title="Products & Services"
      headerButtons={() => (
        <Button type="primary" icon={<PlusOutlined />}>
          Add Product
        </Button>
      )}
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <Input
            placeholder="Search products..."
            prefix={<SearchOutlined style={{ color: "#555" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Space>
            <Tag color="green" style={{ margin: 0, padding: "2px 10px" }}>
              {activeCount} Active
            </Tag>
            <Tag color="default" style={{ margin: 0, padding: "2px 10px" }}>
              {mockProducts.length - activeCount} Inactive
            </Tag>
          </Space>
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 750 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => (
              <span style={{ color: "#808080" }}>{total} products</span>
            ),
          }}
        >
          <Table.Column
            title="Product"
            width={280}
            render={(_: unknown, record: MockProduct) => (
              <div>
                <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                  {record.name}
                </Text>
                <Text style={{ color: "#808080", fontSize: 11 }}>
                  {record.description}
                </Text>
              </div>
            )}
          />
          <Table.Column
            dataIndex="category"
            title="Category"
            width={100}
            render={(v: string) => (
              <Tag color={v === "paper" ? "blue" : "purple"}>
                {v === "paper" ? "📄 Paper" : "🧊 3D"}
              </Tag>
            )}
            filters={[
              { text: "Paper", value: "paper" },
              { text: "3D", value: "3d" },
            ]}
            onFilter={(value, record: MockProduct) => record.category === value}
          />
          <Table.Column
            dataIndex="base_price"
            title="Base Price"
            width={120}
            align="right"
            render={(v: number, record: MockProduct) => (
              <Tooltip title={record.unit}>
                <div>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span>
                  <br />
                  <Text style={{ color: "#666", fontSize: 10 }}>{record.unit}</Text>
                </div>
              </Tooltip>
            )}
            sorter={(a: MockProduct, b: MockProduct) => a.base_price - b.base_price}
          />
          <Table.Column
            dataIndex="is_active"
            title="Active"
            width={80}
            align="center"
            render={(active: boolean) => (
              <Switch
                checked={active}
                size="small"
                onChange={() => {
                  /* TODO: toggle active status */
                }}
              />
            )}
            filters={[
              { text: "Active", value: true },
              { text: "Inactive", value: false },
            ]}
            onFilter={(value, record: MockProduct) => record.is_active === value}
          />
          <Table.Column
            title=""
            width={60}
            fixed="right"
            render={() => (
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                style={{ color: "#808080" }}
              />
            )}
          />
        </Table>
      </Space>
    </List>
  );
}
