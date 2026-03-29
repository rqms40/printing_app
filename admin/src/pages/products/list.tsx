import { List } from "@refinedev/antd";
import { Table, Tag, Typography, Button } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { formatCurrency } from "@/utils/format";

const { Text } = Typography;

const mockProducts = [
  { id: "1", name: "Document Printing (A4)", category: "paper", base_price: 5, description: "Standard A4 document printing", is_active: true },
  { id: "2", name: "Document Printing (A3)", category: "paper", base_price: 15, description: "Large format A3 documents", is_active: true },
  { id: "3", name: "Poster Printing (A1)", category: "paper", base_price: 120, description: "Full-color poster printing", is_active: true },
  { id: "4", name: "Photo Printing (Glossy)", category: "paper", base_price: 25, description: "High-quality glossy photo prints", is_active: true },
  { id: "5", name: "Business Cards (100pcs)", category: "paper", base_price: 350, description: "Premium matte business cards", is_active: true },
  { id: "6", name: "3D Print - PLA Standard", category: "3d", base_price: 50, description: "Per 10g of PLA material", is_active: true },
  { id: "7", name: "3D Print - ABS Standard", category: "3d", base_price: 65, description: "Per 10g of ABS material", is_active: true },
  { id: "8", name: "3D Print - PETG Premium", category: "3d", base_price: 80, description: "Per 10g of PETG material", is_active: false },
  { id: "9", name: "Spiral Binding", category: "paper", base_price: 45, description: "Add spiral binding to any document", is_active: true },
  { id: "10", name: "Lamination (A4)", category: "paper", base_price: 20, description: "Matte or glossy lamination", is_active: true },
];

type MockProduct = typeof mockProducts[0];

export function ProductList() {
  return (
    <List
      title="Products & Services"
      headerButtons={() => (
        <Button type="primary" icon={<PlusOutlined />}>
          Add Product
        </Button>
      )}
    >
      <Table dataSource={mockProducts} rowKey="id">
        <Table.Column
          title="Product"
          render={(_: unknown, record: MockProduct) => (
            <div>
              <Text strong style={{ color: "#F0F0F0", display: "block" }}>
                {record.name}
              </Text>
              <Text style={{ color: "#808080", fontSize: 12 }}>{record.description}</Text>
            </div>
          )}
        />
        <Table.Column
          dataIndex="category"
          title="Category"
          render={(v: string) => (
            <Tag color={v === "paper" ? "blue" : "purple"}>
              {v === "paper" ? "Paper" : "3D"}
            </Tag>
          )}
        />
        <Table.Column
          dataIndex="base_price"
          title="Base Price"
          render={(v: number) => formatCurrency(v)}
          sorter={(a: MockProduct, b: MockProduct) => a.base_price - b.base_price}
        />
        <Table.Column
          dataIndex="is_active"
          title="Status"
          render={(active: boolean) => (
            <Tag color={active ? "green" : "default"}>{active ? "Active" : "Inactive"}</Tag>
          )}
        />
        <Table.Column
          title="Actions"
          render={() => (
            <Button type="text" icon={<EditOutlined />} size="small">
              Edit
            </Button>
          )}
        />
      </Table>
    </List>
  );
}
