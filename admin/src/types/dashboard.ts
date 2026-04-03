export interface DashboardKPIs {
  new_orders_count: number;
  in_production_count: number;
  ready_for_pickup_count: number;
  delivered_count: number;
  avg_tat_mins: number;
  error_rate_percent: number;
}

export interface ChartDataPoint {
  month: string;
  value: number;
}
